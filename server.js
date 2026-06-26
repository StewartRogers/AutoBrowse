// server.js — local dev API for AutoBrowse.
//
// ESM module (matches package.json "type": "module"). Data access goes through db.js,
// which uses @libsql/client: a local SQLite file by default, or Turso in production.
// The Express app is exported so it can be reused by a serverless handler when deployed.

import express from 'express';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { db, isLocalFile, initSchema } from './db.js';
import { installAuthRoutes, requireAuth } from './auth.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing that works both as a standalone server and as a Vercel function.
// Vercel's Node runtime may have already parsed the JSON body (consuming the
// stream), in which case express.json() would overwrite it with {}. So if a parsed
// object is already present, skip straight through; otherwise parse the stream.
const parseJson = express.json({ limit: '2mb' });
app.use((req, res, next) => {
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return next();
  }
  return parseJson(req, res, next);
});

const schemaReady = initSchema();
console.log(`Database: ${process.env.TURSO_DATABASE_URL || 'file:garage.db'}${isLocalFile ? ' (local)' : ' (Turso)'}`);

// Ensure the schema exists before any request touches the DB.
app.use(async (req, res, next) => {
  try {
    await schemaReady;
    next();
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message) });
  }
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
// Public auth endpoints (login/logout/status) are registered first so they stay
// reachable without a session. Everything mounted after requireAuth is gated:
// the API — not just the UI — is the real security boundary, since the SPA shell
// is served statically and anyone can call /api/* directly.

installAuthRoutes(app);
app.use('/api', requireAuth);

// ─── Vehicle endpoints ──────────────────────────────────────────────────────

// GET /api/vehicles — return all vehicles ordered by createdAt desc
app.get('/api/vehicles', async (req, res) => {
  try {
    const result = await db.execute("SELECT data FROM vehicles ORDER BY json_extract(data, '$.createdAt') DESC");
    res.json({ ok: true, vehicles: result.rows.map(r => JSON.parse(r.data)) });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message) });
  }
});

// POST /api/vehicles — create a vehicle (body = full Vehicle object)
app.post('/api/vehicles', async (req, res) => {
  try {
    const v = req.body;
    if (!v?.id) return res.status(400).json({ ok: false, error: 'Missing id.' });
    await db.execute({
      sql: 'INSERT OR REPLACE INTO vehicles (id, data, updated_at) VALUES (?, ?, unixepoch())',
      args: [v.id, JSON.stringify(v)],
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message) });
  }
});

// PUT /api/vehicles/:id — replace a vehicle (body = full Vehicle object)
app.put('/api/vehicles/:id', async (req, res) => {
  try {
    const v = { ...req.body, id: req.params.id };
    await db.execute({
      sql: 'INSERT OR REPLACE INTO vehicles (id, data, updated_at) VALUES (?, ?, unixepoch())',
      args: [req.params.id, JSON.stringify(v)],
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message) });
  }
});

// DELETE /api/vehicles/:id — permanently remove a vehicle
app.delete('/api/vehicles/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM vehicles WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message) });
  }
});

// ─── Matrix endpoints ───────────────────────────────────────────────────────

// GET /api/matrix
app.get('/api/matrix', async (req, res) => {
  try {
    const result = await db.execute('SELECT data FROM matrix WHERE id = 1');
    const row = result.rows[0];
    res.json({ ok: true, matrix: row ? JSON.parse(row.data) : null });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message) });
  }
});

// PUT /api/matrix — replace the full matrix factors array
app.put('/api/matrix', async (req, res) => {
  try {
    if (!Array.isArray(req.body)) return res.status(400).json({ ok: false, error: 'Body must be an array.' });
    await db.execute({
      sql: 'INSERT OR REPLACE INTO matrix (id, data) VALUES (1, ?)',
      args: [JSON.stringify(req.body)],
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message) });
  }
});

// ─── Gemini proxy ─────────────────────────────────────────────────────────────
// Keeps the Gemini API key server-side. The browser POSTs a prompt here and the
// server forwards it to Gemini with the secret key, so the key is never shipped in
// the client bundle. Reads GEMINI_API_KEY (preferred) or legacy VITE_GEMINI_API_KEY.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || 'gemini-3.1-flash-lite';

// POST /api/gemini — body { contents: string } → { ok, text }
app.post('/api/gemini', async (req, res) => {
  try {
    const contents = req.body?.contents;
    if (typeof contents !== 'string' || !contents.trim()) {
      return res.status(400).json({ ok: false, error: 'Missing prompt contents.' });
    }
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ ok: false, error: 'Server is missing GEMINI_API_KEY. Set it in the environment (no VITE_ prefix).' });
    }
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: { temperature: 0 },
    });
    return res.json({ ok: true, text: response.text ?? '' });
  } catch (err) {
    // Pass Gemini's error message through; the client formats it for display.
    return res.status(502).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── HTML scrape endpoint ───────────────────────────────────────────────────

function extractMeta(html, name) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function extractTag(html, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]+)<\\/${tag}>`, 'i'));
  return match?.[1]?.trim() || '';
}

function parseYear(value) {
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
}

function parsePrice(value) {
  const match = value.replace(/,/g, '').match(/(?:CA\$|\$)\s*([\d.]+)/i);
  return match ? Number(match[1]) : undefined;
}

app.get('/api/scrape-html', async (req, res) => {
  try {
    const url = String(req.query.url || '').trim();
    if (!url) {
      return res.status(400).json({ ok: false, error: 'Missing url query parameter.' });
    }

    const MAX_HTML_BYTES = 5 * 1024 * 1024;
    const response = await fetch(url, {
      headers: {
        'user-agent': 'AutoBrowse/1.0',
        accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return res.status(502).json({ ok: false, error: `Upstream request failed (${response.status} ${response.statusText}).` });
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_HTML_BYTES) {
      return res.status(502).json({ ok: false, error: `Response too large (${(contentLength / 1024 / 1024).toFixed(1)} MB).` });
    }

    const html = await response.text();
    const title = extractMeta(html, 'og:title') || extractTag(html, 'title');
    const description = extractMeta(html, 'description') || extractMeta(html, 'og:description');
    const image = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image');

    const data = {};
    const seed = `${title} ${description}`.trim();
    if (title) {
      const year = parseYear(title);
      if (year) data.year = year;
      const cleaned = title.split(' - ')[0].split('|')[0].replace(/\b(19|20)\d{2}\b/, '').trim();
      const parts = cleaned.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        data.make = parts[0];
        data.model = parts[1];
        if (parts.length > 2) data.trim = parts.slice(2).join(' ');
      }
    }
    if (seed.toLowerCase().includes('suv')) data.bodyStyle = 'SUV';
    else if (seed.toLowerCase().includes('sedan')) data.bodyStyle = 'Sedan';
    else if (seed.toLowerCase().includes('truck')) data.bodyStyle = 'Truck';
    if (description) {
      const dealerMatch = description.match(/dealer(?:ship)?[:\s-]+([^.|]+)/i);
      if (dealerMatch) data.dealer = dealerMatch[1].trim();
      const colorMatch = description.match(/color[:\s-]+([^.|]+)/i);
      if (colorMatch) data.color = colorMatch[1].trim();
      const price = parsePrice(description);
      if (price) data.pricing = { msrp: price, sellingPrice: price, discounts: 0, incentives: 0, fees: 0, tradeValue: 0, taxRate: 0 };
    }
    if (image) data.photoUrl = image;

    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Wikipedia photo fallback ───────────────────────────────────────────────

app.get('/api/wiki-photo', async (req, res) => {
  try {
    const year  = String(req.query.year  || '').trim();
    const make  = String(req.query.make  || '').trim();
    const model = String(req.query.model || '').trim();
    if (!make || !model) {
      return res.status(400).json({ ok: false, error: 'Missing make or model.' });
    }

    // Try progressively simpler titles: "YYYY Make Model", "Make Model", "Make Model (automobile)"
    const candidates = [
      year ? `${year} ${make} ${model}` : null,
      `${make} ${model}`,
      `${make} ${model} (automobile)`,
    ].filter(Boolean).map(t => t.replace(/ /g, '_'));

    for (const title of candidates) {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'AutoBrowse/1.0 (car research app)' }, signal: AbortSignal.timeout(10000) });
      if (!resp.ok) continue;
      const json = await resp.json();
      const thumb = json?.thumbnail?.source || json?.originalimage?.source;
      if (thumb) return res.json({ ok: true, photoUrl: thumb });
    }

    return res.json({ ok: false, error: 'No Wikipedia photo found.' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── Root ───────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({ message: 'AutoBrowse API' });
});

// Start a listener only when run directly (`node server.js`). When this module is
// imported by a serverless handler, the importer owns the request lifecycle instead.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  const shutdown = () => {
    server.close();
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default app;
