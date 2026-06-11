const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));

// ─── Database ──────────────────────────────────────────────────────────────

const DB_PATH = path.join(__dirname, 'garage.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS vehicles (
    id         TEXT    PRIMARY KEY,
    data       TEXT    NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS matrix (
    id   INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT    NOT NULL
  );
`);

const stmt = {
  allVehicles:   db.prepare("SELECT data FROM vehicles ORDER BY json_extract(data, '$.createdAt') DESC"),
  upsertVehicle: db.prepare('INSERT OR REPLACE INTO vehicles (id, data, updated_at) VALUES (?, ?, unixepoch())'),
  deleteVehicle: db.prepare('DELETE FROM vehicles WHERE id = ?'),
  countVehicles: db.prepare('SELECT COUNT(*) AS n FROM vehicles'),
  getMatrix:     db.prepare('SELECT data FROM matrix WHERE id = 1'),
  upsertMatrix:  db.prepare('INSERT OR REPLACE INTO matrix (id, data) VALUES (1, ?)'),
};

console.log(`Database: ${DB_PATH}`);

// ─── Vehicle endpoints ──────────────────────────────────────────────────────

// GET /api/vehicles — return all vehicles ordered by createdAt desc
app.get('/api/vehicles', (req, res) => {
  try {
    const rows = stmt.allVehicles.all();
    res.json({ ok: true, vehicles: rows.map(r => JSON.parse(r.data)) });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message) });
  }
});

// POST /api/vehicles — create a vehicle (body = full Vehicle object)
app.post('/api/vehicles', (req, res) => {
  try {
    const v = req.body;
    if (!v?.id) return res.status(400).json({ ok: false, error: 'Missing id.' });
    stmt.upsertVehicle.run(v.id, JSON.stringify(v));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message) });
  }
});

// PUT /api/vehicles/:id — replace a vehicle (body = full Vehicle object)
app.put('/api/vehicles/:id', (req, res) => {
  try {
    const v = { ...req.body, id: req.params.id };
    stmt.upsertVehicle.run(req.params.id, JSON.stringify(v));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message) });
  }
});

// DELETE /api/vehicles/:id — permanently remove a vehicle
app.delete('/api/vehicles/:id', (req, res) => {
  try {
    stmt.deleteVehicle.run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message) });
  }
});

// ─── Matrix endpoints ───────────────────────────────────────────────────────

// GET /api/matrix
app.get('/api/matrix', (req, res) => {
  try {
    const row = stmt.getMatrix.get();
    res.json({ ok: true, matrix: row ? JSON.parse(row.data) : null });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message) });
  }
});

// PUT /api/matrix — replace the full matrix factors array
app.put('/api/matrix', (req, res) => {
  try {
    if (!Array.isArray(req.body)) return res.status(400).json({ ok: false, error: 'Body must be an array.' });
    stmt.upsertMatrix.run(JSON.stringify(req.body));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message) });
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

    const response = await fetch(url, {
      headers: {
        'user-agent': 'AutoBrowse/1.0',
        accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      return res.status(502).json({ ok: false, error: `Upstream request failed (${response.status} ${response.statusText}).` });
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
      const resp = await fetch(url, { headers: { 'User-Agent': 'AutoBrowse/1.0 (car research app)' } });
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
  res.json({ message: 'AutoBrowse API', db: DB_PATH });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
