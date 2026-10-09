// @vitest-environment node
// Server-side scrape module (scrape.js): SSRF guard, body cap, ReDoS-safe parsing.
import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';
import dns from 'node:dns/promises';
import {
  isPrivateIPv4, isPrivateIPv6, validatePublicHttpUrl, fetchPublicHtml,
  readBodyCapped, TooLargeError, parseListingHtml,
} from '../../scrape.js';

vi.mock('node:dns/promises', () => ({ default: { lookup: vi.fn() } }));

describe('isPrivateIPv4', () => {
  it.each(['127.0.0.1', '10.1.2.3', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.0.1',
    '198.51.100.7', '203.0.113.9', '192.88.99.1', '224.0.0.1', '0.0.0.0'])('blocks %s', ip => {
    expect(isPrivateIPv4(ip)).toBe(true);
  });
  it.each(['8.8.8.8', '1.1.1.1', '151.101.1.69'])('allows %s', ip => {
    expect(isPrivateIPv4(ip)).toBe(false);
  });
});

describe('isPrivateIPv6', () => {
  it.each([
    '::', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '0:0:0:0:0:ffff:7f00:1',
    '::7f00:1', '::127.0.0.1', 'fe80::1', 'febf::1', 'fec0::1', 'fc00::1', 'fd12:3456::1', 'ff02::1',
    '64:ff9b::7f00:1', '2002:7f00:1::', '2001::1', '2001:db8::1', '100::1', 'fe80::1%eth0',
  ])('blocks %s', ip => {
    expect(isPrivateIPv6(ip)).toBe(true);
  });
  it.each(['2606:4700:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8', '::ffff:808:808'])('allows %s', ip => {
    expect(isPrivateIPv6(ip)).toBe(false);
  });
});

describe('validatePublicHttpUrl', () => {
  it.each([
    'http://127.0.0.1/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://[::ffff:7f00:1]/',
    'http://[::ffff:a9fe:a9fe]/', 'http://0x7f.1/', 'http://2130706433/', 'http://localhost/',
    'http://a.localhost/', 'file:///etc/passwd', 'ftp://example.com/', 'http://user:pw@example.com/', 'not a url',
  ])('rejects %s', url => {
    expect(() => validatePublicHttpUrl(url)).toThrow();
  });
  it('accepts a public hostname (resolved later, at connect time)', () => {
    expect(validatePublicHttpUrl('https://example.com/car').hostname).toBe('example.com');
  });
});

describe('fetchPublicHtml', () => {
  it('refuses a hostname whose DNS answer is private (checked at connect time)', async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    await expect(fetchPublicHtml('http://rebind.test:9/')).rejects.toThrow('Only public internet hosts');
  });
  it('refuses when any resolved address is private', async () => {
    vi.mocked(dns.lookup).mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '::ffff:7f00:1', family: 6 },
    ]);
    await expect(fetchPublicHtml('http://mixed.test:9/')).rejects.toThrow('Only public internet hosts');
  });
});

function fakeResponse(body, headers = {}) {
  const stream = Readable.from([body]);
  stream.headers = headers;
  return stream;
}

describe('readBodyCapped', () => {
  it('reads a plain body', async () => {
    expect(await readBodyCapped(fakeResponse(Buffer.from('<html>hi</html>')), 1024)).toBe('<html>hi</html>');
  });
  it('decompresses gzip', async () => {
    const gz = zlib.gzipSync('<title>2024 Kia EV9</title>');
    expect(await readBodyCapped(fakeResponse(gz, { 'content-encoding': 'gzip' }), 1024)).toBe('<title>2024 Kia EV9</title>');
  });
  it('aborts an oversized body', async () => {
    await expect(readBodyCapped(fakeResponse(Buffer.alloc(2048, 97)), 1024)).rejects.toBeInstanceOf(TooLargeError);
  });
  it('aborts a compression bomb by decompressed size', async () => {
    const bomb = zlib.gzipSync(Buffer.alloc(10 * 1024 * 1024)); // ~10 KB on the wire
    await expect(readBodyCapped(fakeResponse(bomb, { 'content-encoding': 'gzip' }), 1024 * 1024))
      .rejects.toBeInstanceOf(TooLargeError);
  });
});

describe('parseListingHtml', () => {
  it('extracts fields from og tags and description', () => {
    const html = `<html><head>
      <title>ignored</title>
      <meta property="og:title" content="2024 Kia EV9 Land - Example Motors">
      <meta name="description" content="Dealer: Example Motors. Color: Snow White. Price $72,995">
      <meta content="https://img.example.com/ev9.jpg" property="og:image" />
    </head></html>`;
    expect(parseListingHtml(html)).toEqual({
      year: 2024, make: 'Kia', model: 'EV9', trim: 'Land',
      dealer: 'Example Motors', color: 'Snow White',
      pricing: { msrp: 72995, discount: 0, incentives: 0, fees: [], tradeValue: 0, taxRate: 0 },
      photoUrl: 'https://img.example.com/ev9.jpg',
    });
  });
  it('falls back to <title> and name= tags', () => {
    const html = `<TITLE>2023 Toyota RAV4 SUV | Lot</TITLE><meta name='og:image' content='https://x.example/r.jpg'>`;
    expect(parseListingHtml(html)).toMatchObject({ year: 2023, make: 'Toyota', model: 'RAV4', trim: 'SUV', bodyStyle: 'SUV', photoUrl: 'https://x.example/r.jpg' });
  });
  it('stays fast on adversarial HTML (no catastrophic backtracking)', () => {
    const inputs = [
      '<meta '.repeat(800_000),
      `<meta${' content="'.repeat(200)}>`.repeat(2_000),
      `<title>${'a'.repeat(4_000_000)}</title>`,
    ];
    const t0 = Date.now();
    for (const html of inputs) parseListingHtml(html);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});
