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
import { MAX_HTML_BYTES, ScrapeError, TooLargeError, fetchPublicHtml, readBodyCapped, parseListingHtml } from './scrape.js';

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 3000;

// Lightweight tagged logging for the AI/scrape endpoints. These calls reach out to
// slow third parties (Gemini, Wikipedia), so logging each phase with elapsed time
// makes a hang or slow path obvious instead of invisible. `t0` is from Date.now().
function logTag(tag, msg) {
  console.log(`[${new Date().toISOString()}] [${tag}] ${msg}`);
}
const since = (t0) => `${Date.now() - t0}ms`;

const errorMessage = (err) => (err instanceof Error ? err.message : String(err));
// Unexpected failures (libsql/Turso, sockets) are logged here and reported to the
// client generically, so internals like hostnames, ports and SQL never leak out.
const sendError = (res, err, status = 500) => {
  console.error(`[error] ${errorMessage(err)}`);
  res.status(status).json({ ok: false, error: 'Internal server error.' });
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isValidId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 128;

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
// Log only the host for Turso: the URL may carry credentials (e.g. ?authToken=).
const dbLabel = () => {
  const url = process.env.TURSO_DATABASE_URL || 'file:garage.db';
  if (isLocalFile) return `${url} (local)`;
  try { return `${new URL(url).host} (Turso)`; } catch { return '(Turso)'; }
};
console.log(`Database: ${dbLabel()}`);

// Ensure the schema exists before any request touches the DB.
app.use(async (req, res, next) => {
  try {
    await schemaReady;
    next();
  } catch (err) {
    sendError(res, err);
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

const UPSERT_VEHICLE = 'INSERT OR REPLACE INTO vehicles (id, data, updated_at) VALUES (?, ?, unixepoch())';

// GET /api/vehicles — return all vehicles ordered by createdAt desc
app.get('/api/vehicles', async (req, res) => {
  try {
    const result = await db.execute("SELECT data FROM vehicles ORDER BY json_extract(data, '$.createdAt') DESC");
    res.json({ ok: true, vehicles: result.rows.map(r => JSON.parse(r.data)) });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/vehicles — create a vehicle (body = full Vehicle object)
app.post('/api/vehicles', async (req, res) => {
  try {
    const v = req.body;
    if (!isPlainObject(v)) return res.status(400).json({ ok: false, error: 'Body must be a vehicle object.' });
    if (!isValidId(v.id)) return res.status(400).json({ ok: false, error: 'Missing or invalid id.' });
    await db.execute({
      sql: UPSERT_VEHICLE,
      args: [v.id, JSON.stringify(v)],
    });
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});

// PUT /api/vehicles/:id — replace a vehicle (body = full Vehicle object)
app.put('/api/vehicles/:id', async (req, res) => {
  try {
    // An empty or non-JSON body would otherwise be saved as just {id}, wiping the vehicle.
    if (!isPlainObject(req.body)) return res.status(400).json({ ok: false, error: 'Body must be a vehicle object.' });
    if (!isValidId(req.params.id)) return res.status(400).json({ ok: false, error: 'Invalid id.' });
    const v = { ...req.body, id: req.params.id };
    await db.execute({
      sql: UPSERT_VEHICLE,
      args: [req.params.id, JSON.stringify(v)],
    });
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});

// DELETE /api/vehicles/:id — permanently remove a vehicle
app.delete('/api/vehicles/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM vehicles WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
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
    sendError(res, err);
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
    sendError(res, err);
  }
});

// ─── Gemini proxy ─────────────────────────────────────────────────────────────
// Keeps the Gemini API key server-side. The browser POSTs a prompt here and the
// server forwards it to Gemini with the secret key, so the key is never shipped in
// the client bundle. Reads GEMINI_API_KEY only — never a VITE_-prefixed name, which
// Vite would inline into the bundle if client code ever referenced it.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

// Give up on a hung Gemini call so the request doesn't hang forever. Kept just
// under the client's 30s abort (geminiScrape.ts) so the server can return a clean
// 504 JSON error before the browser aborts on its own.
const GEMINI_TIMEOUT_MS = 28_000;
// Real prompts are a few KB; cap them so a caller can't burn quota with huge bodies.
const MAX_PROMPT_CHARS = 100_000;

// POST /api/gemini — body { contents: string } → { ok, text }
app.post('/api/gemini', async (req, res) => {
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const contents = req.body?.contents;
    if (typeof contents !== 'string' || !contents.trim()) {
      logTag('gemini', 'rejected: missing prompt contents');
      return res.status(400).json({ ok: false, error: 'Missing prompt contents.' });
    }
    if (contents.length > MAX_PROMPT_CHARS) {
      logTag('gemini', `rejected: prompt too long (${contents.length} chars)`);
      return res.status(413).json({ ok: false, error: 'Prompt is too long.' });
    }
    if (!GEMINI_API_KEY) {
      logTag('gemini', 'rejected: GEMINI_API_KEY not configured on server');
      return res.status(500).json({ ok: false, error: 'Server is missing GEMINI_API_KEY. Set it in the environment (no VITE_ prefix).' });
    }
    logTag('gemini', `→ model=${GEMINI_MODEL} promptChars=${contents.length}`);
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: { temperature: 0, abortSignal: controller.signal },
    });
    const text = response.text ?? '';
    logTag('gemini', `✓ ok in ${since(t0)} responseChars=${text.length}`);
    return res.json({ ok: true, text });
  } catch (err) {
    if (controller.signal.aborted) {
      logTag('gemini', `✗ timed out after ${since(t0)} (limit ${GEMINI_TIMEOUT_MS / 1000}s)`);
      return res.status(504).json({ ok: false, error: `Gemini request timed out after ${GEMINI_TIMEOUT_MS / 1000}s.` });
    }
    // Pass Gemini's error message through; the client formats it for display.
    const msg = errorMessage(err);
    logTag('gemini', `✗ error in ${since(t0)}: ${msg.slice(0, 200)}`);
    return res.status(502).json({ ok: false, error: msg });
  } finally {
    clearTimeout(timer);
  }
});

// ─── HTML scrape endpoint ───────────────────────────────────────────────────
// Fetching and parsing live in scrape.js (SSRF guard, body cap, ReDoS-safe parser).

app.get('/api/scrape-html', async (req, res) => {
  try {
    const url = String(req.query.url || '').trim();
    if (!url) {
      return res.status(400).json({ ok: false, error: 'Missing url query parameter.' });
    }

    const response = await fetchPublicHtml(url, {
      headers: {
        'user-agent': 'AutoBrowse/1.0',
        accept: 'text/html,application/xhtml+xml',
        'accept-encoding': 'gzip, deflate, br',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      response.resume();
      return res.status(502).json({ ok: false, error: `Upstream request failed (${response.statusCode} ${response.statusMessage}).` });
    }

    const contentLength = Number(response.headers['content-length'] || 0);
    if (contentLength > MAX_HTML_BYTES) {
      response.destroy();
      return res.status(502).json({ ok: false, error: `Response too large (${(contentLength / 1024 / 1024).toFixed(1)} MB).` });
    }

    const html = await readBodyCapped(response, MAX_HTML_BYTES);
    return res.json({ ok: true, data: parseListingHtml(html) });
  } catch (err) {
    // ScrapeError messages (bad URL, private host, too large) are meant for the user.
    // Raw socket errors (ECONNREFUSED host:port, ENOTFOUND) are not echoed back.
    if (err instanceof ScrapeError) return res.status(err instanceof TooLargeError ? 502 : 400).json({ ok: false, error: err.message });
    if (err?.name === 'TimeoutError') return res.status(504).json({ ok: false, error: 'The listing page took too long to respond.' });
    logTag('scrape-html', `✗ ${errorMessage(err)}`);
    return res.status(502).json({ ok: false, error: 'Could not fetch that page.' });
  }
});

// ─── Wikipedia photo fallback ───────────────────────────────────────────────

app.get('/api/wiki-photo', async (req, res) => {
  const t0 = Date.now();
  try {
    const year  = String(req.query.year  || '').trim();
    const make  = String(req.query.make  || '').trim();
    const model = String(req.query.model || '').trim();
    if (!make || !model) {
      logTag('wiki-photo', 'rejected: missing make or model');
      return res.status(400).json({ ok: false, error: 'Missing make or model.' });
    }

    // Try progressively simpler titles: "YYYY Make Model", "Make Model", "Make Model (automobile)"
    const candidates = [
      year ? `${year} ${make} ${model}` : null,
      `${make} ${model}`,
      `${make} ${model} (automobile)`,
    ].filter(Boolean).map(t => t.replace(/ /g, '_'));

    // Query all candidates in PARALLEL so total time is bounded by the slowest
    // single call (~6s), not the sum. Sequential 10s-each could stall up to 30s
    // when a title hangs — the freeze that made this look broken locally. Each
    // call is isolated; we then prefer the highest-priority title that hit.
    logTag('wiki-photo', `→ trying ${candidates.length} candidate(s) in parallel for ${make} ${model}`);
    const lookups = candidates.map(async (title) => {
      const tc = Date.now();
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      try {
        const resp = await fetch(url, { headers: { 'User-Agent': 'AutoBrowse/1.0 (car research app)' }, signal: AbortSignal.timeout(6000) });
        if (!resp.ok) {
          logTag('wiki-photo', `  · "${title}" → HTTP ${resp.status} in ${since(tc)}`);
          return null;
        }
        const json = await resp.json();
        // Use the thumbnail URL EXACTLY as the summary API advertises it. It is a
        // known-good, already-rendered size that always loads. (A previous attempt
        // to bump the width to 1024px returned HTTP 400 for many files — Wikimedia
        // only reliably serves the size it gives you here — so the photo was
        // "found" but the <img> failed. With object-fit: contain it's sharp enough;
        // fall back to the full-resolution original if there is no thumbnail.)
        const photo = json?.thumbnail?.source || json?.originalimage?.source || null;
        logTag('wiki-photo', `  · "${title}" → ${photo ? 'photo' : 'no image'} in ${since(tc)}`);
        return photo;
      } catch (e) {
        const m = e instanceof Error ? e.name : String(e);
        logTag('wiki-photo', `  · "${title}" → ${m} after ${since(tc)}`);
        return null;
      }
    });

    const results = await Promise.all(lookups);
    const photoUrl = results.find(Boolean) || null; // candidates are in priority order
    if (photoUrl) {
      logTag('wiki-photo', `✓ photo found (total ${since(t0)})`);
      return res.json({ ok: true, photoUrl });
    }

    logTag('wiki-photo', `✗ no photo found (total ${since(t0)})`);
    return res.json({ ok: false, error: 'No Wikipedia photo found.' });
  } catch (err) {
    logTag('wiki-photo', `✗ error in ${since(t0)}: ${errorMessage(err)}`);
    return sendError(res, err);
  }
});

// ─── Root ───────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({ message: 'AutoBrowse API' });
});

// Final error handler: malformed JSON, oversize bodies and anything thrown outside a
// route's try/catch get a JSON reply instead of Express's HTML page (which includes a
// stack trace outside production).
app.use((err, req, res, next) => {
  const status = Number(err?.status || err?.statusCode) || 500;
  if (status >= 500) return sendError(res, err, status);
  res.status(status).json({ ok: false, error: status === 413 ? 'Request body is too large.' : 'Bad request.' });
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
