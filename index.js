const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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

app.get('/', (req, res) => {
  res.json({ message: 'AutoBrowse API' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
