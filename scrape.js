// scrape.js — server-side fetch + parse for GET /api/scrape-html.
//
// The URL comes from the user (or a page they pasted), so this is an SSRF and
// parser-DoS boundary:
//   - Only public http(s) hosts are reachable. Every address is checked at
//     connect time via a custom `lookup`, so the IP that was validated is the IP
//     that gets connected to (no DNS-rebinding gap), and every redirect hop is
//     re-validated.
//   - The body is streamed with a hard byte cap (after decompression), never
//     buffered whole first.
//   - HTML is scanned with indexOf + small bounded regexes — no regex runs across
//     the whole attacker-controlled document (ReDoS).

import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';

export const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = [301, 302, 303, 307, 308];

// ─── Address checks ─────────────────────────────────────────────────────────

export function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

// Expands any textual IPv6 form ("::", zone ids, embedded dotted quad) to 16
// bytes, or null if it isn't valid IPv6.
function ipv6Bytes(ip) {
  let s = ip.toLowerCase().split('%')[0];
  const dotted = s.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (dotted) {
    const q = dotted.slice(2).map(Number);
    if (q.some(n => n > 255)) return null;
    s = `${dotted[1]}${((q[0] << 8) | q[1]).toString(16)}:${((q[2] << 8) | q[3]).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array(fill).fill('0'), ...tail];
  if (groups.length !== 8 || groups.some(g => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.flatMap(g => {
    const n = parseInt(g, 16);
    return [n >> 8, n & 0xff];
  });
}

export function isPrivateIPv6(ip) {
  const b = ipv6Bytes(ip);
  if (!b) return true;
  const zeroUpTo = (n) => b.slice(0, n).every(x => x === 0);
  // IPv4-mapped (::ffff:a.b.c.d in any spelling, e.g. ::ffff:7f00:1): judge the IPv4 address.
  if (zeroUpTo(10) && b[10] === 0xff && b[11] === 0xff) return isPrivateIPv4(b.slice(12).join('.'));
  return (
    zeroUpTo(12) ||                                                    // ::, ::1, IPv4-compatible ::a.b.c.d
    (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) || // 64:ff9b::/32 NAT64
    (b[0] === 0x01 && b[1] === 0x00 && b.slice(2, 8).every(x => x === 0)) || // 100::/64 discard
    (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) || // 2001::/32 Teredo
    (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) || // 2001:db8::/32 documentation
    (b[0] === 0x20 && b[1] === 0x02) ||                               // 2002::/16 6to4
    (b[0] & 0xfe) === 0xfc ||                                         // fc00::/7 unique local
    (b[0] === 0xfe && (b[1] & 0x80) === 0x80) ||                      // fe80::/10 link-local, fec0::/10 site-local
    b[0] === 0xff                                                     // ff00::/8 multicast
  );
}

export function isPrivateAddress(address, family) {
  if (family === 4 || family === 'IPv4') return isPrivateIPv4(address);
  if (family === 6 || family === 'IPv6') return isPrivateIPv6(address);
  return true;
}

const NOT_PUBLIC = 'Only public internet hosts can be scraped.';

// A rejection whose message is safe and useful to show the user (bad URL,
// private host, redirect loop, oversize body). Anything else is an unexpected
// network/socket error and is reported generically by the server.
export class ScrapeError extends Error {}

// Syntactic checks plus, for IP literals, the address check. Hostnames are
// checked when they are resolved (publicLookup), not here.
export function validatePublicHttpUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ScrapeError('URL is not valid.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ScrapeError('Only http and https URLs can be scraped.');
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new ScrapeError('URL must include a plain public hostname.');
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new ScrapeError('Localhost URLs cannot be scraped.');
  }
  const literalFamily = net.isIP(host);
  if (literalFamily && isPrivateAddress(host, literalFamily)) throw new ScrapeError(NOT_PUBLIC);
  return parsed;
}

// Socket `lookup` that refuses private addresses. Because the socket connects to
// exactly what this returns, there is no window for DNS rebinding. Node skips
// lookup for IP literals; validatePublicHttpUrl covers those.
function publicLookup(hostname, options, callback) {
  const wantAll = typeof options === 'object' && options?.all;
  dns.lookup(hostname, { all: true, verbatim: true }).then(
    (addresses) => {
      if (!addresses.length || addresses.some(a => isPrivateAddress(a.address, a.family))) {
        return callback(new ScrapeError(NOT_PUBLIC));
      }
      if (wantAll) return callback(null, addresses);
      return callback(null, addresses[0].address, addresses[0].family);
    },
    (err) => callback(err),
  );
}

// ─── Fetch ──────────────────────────────────────────────────────────────────

function requestOnce(url, headers, signal) {
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(url, { headers, signal, lookup: publicLookup }, resolve);
    req.on('error', reject);
    req.end();
  });
}

// GETs a public URL, following up to MAX_REDIRECTS redirects (each re-validated).
// Resolves with the final http.IncomingMessage; the caller must consume or
// resume() its body.
export async function fetchPublicHtml(rawUrl, { headers = {}, signal } = {}) {
  let url = validatePublicHttpUrl(rawUrl);
  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    const response = await requestOnce(url, headers, signal);
    const location = response.headers.location;
    if (!REDIRECT_STATUSES.includes(response.statusCode) || !location) return response;
    response.resume();
    url = validatePublicHttpUrl(new URL(location, url).toString());
  }
  throw new ScrapeError('Too many redirects while scraping.');
}

const DECOMPRESSORS = {
  gzip: () => zlib.createGunzip(),
  'x-gzip': () => zlib.createGunzip(),
  deflate: () => zlib.createInflate(),
  br: () => zlib.createBrotliDecompress(),
};

export class TooLargeError extends ScrapeError {}

// Reads (and decompresses) the body, aborting as soon as it exceeds maxBytes —
// so neither a huge chunked response nor a compression bomb is held in memory.
export async function readBodyCapped(response, maxBytes = MAX_HTML_BYTES) {
  const encoding = String(response.headers['content-encoding'] || '').trim().toLowerCase();
  const decoder = DECOMPRESSORS[encoding]?.();
  const chunks = [];
  let total = 0;
  await pipeline(...(decoder ? [response, decoder] : [response]), async (source) => {
    for await (const chunk of source) {
      total += chunk.length;
      if (total > maxBytes) throw new TooLargeError(`Response too large (over ${(maxBytes / 1024 / 1024).toFixed(1)} MB).`);
      chunks.push(chunk);
    }
  });
  return Buffer.concat(chunks).toString('utf8');
}

// ─── HTML parsing ───────────────────────────────────────────────────────────

const MAX_TAG_CHARS = 2048;   // real <meta> tags are tiny; skip anything bigger
const MAX_TEXT_CHARS = 1000;  // cap <title> text before further regex work

function attr(tag, name) {
  // Anchored on whitespace + a literal attribute name, run over one bounded tag.
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'));
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

// Returns [{ property, name, content }] for every <meta> tag, in document order.
export function parseMetaTags(html) {
  const lower = html.toLowerCase();
  const metas = [];
  let pos = 0;
  for (;;) {
    const start = lower.indexOf('<meta', pos);
    if (start === -1) break;
    const end = lower.indexOf('>', start);
    if (end === -1) break;
    pos = end + 1;
    if (end - start > MAX_TAG_CHARS) continue;
    const tag = html.slice(start + 5, end);
    const content = attr(tag, 'content');
    if (content === undefined) continue;
    metas.push({
      property: attr(tag, 'property')?.toLowerCase(),
      name: attr(tag, 'name')?.toLowerCase(),
      content: content.trim(),
    });
  }
  return metas;
}

// First non-empty content for `key`, preferring property= matches over name=.
function metaContent(metas, key) {
  return (
    metas.find(m => m.property === key && m.content)?.content ||
    metas.find(m => m.name === key && m.content)?.content ||
    ''
  );
}

function titleText(html) {
  const lower = html.toLowerCase();
  const open = lower.indexOf('<title');
  if (open === -1) return '';
  const start = lower.indexOf('>', open);
  if (start === -1) return '';
  const end = lower.indexOf('</title', start);
  if (end === -1) return '';
  const text = html.slice(start + 1, Math.min(end, start + 1 + MAX_TEXT_CHARS));
  return text.includes('<') ? '' : text.trim();
}

function parseYear(value) {
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
}

function parsePrice(value) {
  const match = value.replace(/,/g, '').match(/(?:CA\$|\$)\s*([\d.]+)/i);
  return match ? Number(match[1]) : undefined;
}

// Best-effort vehicle fields from a listing page's <title> and og:/meta tags.
export function parseListingHtml(html) {
  const metas = parseMetaTags(html);
  const title = metaContent(metas, 'og:title') || titleText(html);
  const description = metaContent(metas, 'description') || metaContent(metas, 'og:description');
  const image = metaContent(metas, 'og:image') || metaContent(metas, 'twitter:image');

  const data = {};
  const seed = `${title} ${description}`.toLowerCase();
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
  if (seed.includes('suv')) data.bodyStyle = 'SUV';
  else if (seed.includes('sedan')) data.bodyStyle = 'Sedan';
  else if (seed.includes('truck')) data.bodyStyle = 'Truck';
  if (description) {
    const dealerMatch = description.match(/dealer(?:ship)?[:\s-]+([^.|]+)/i);
    if (dealerMatch) data.dealer = dealerMatch[1].trim();
    const colorMatch = description.match(/color[:\s-]+([^.|]+)/i);
    if (colorMatch) data.color = colorMatch[1].trim();
    const price = parsePrice(description);
    // Selling price is derived (msrp − discount); the scraped price is the msrp.
    // Fees are an itemized array now (none scraped here).
    if (price) data.pricing = { msrp: price, discount: 0, incentives: 0, fees: [], tradeValue: 0, taxRate: 0 };
  }
  // og:image is page-controlled; only keep absolute http(s) URLs.
  if (image && /^https?:\/\//i.test(image)) data.photoUrl = image;
  return data;
}
