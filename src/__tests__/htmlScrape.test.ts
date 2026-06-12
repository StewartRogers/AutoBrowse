import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrapeVehicleHtmlFromUrl } from '../lib/htmlScrape';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(payload: unknown, httpOk = true, status = 200, statusText = 'OK') {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: httpOk,
    status,
    statusText,
    json: async () => payload,
  }));
}

describe('scrapeVehicleHtmlFromUrl', () => {
  it('returns parsed data on a successful response', async () => {
    const data = { make: 'Toyota', model: 'RAV4', year: 2024 };
    mockFetch({ ok: true, data });
    const result = await scrapeVehicleHtmlFromUrl('https://example.com/vehicle');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(data);
  });

  it('encodes the URL as a query parameter', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const url = 'https://example.com/path?a=1&b=2';
    await scrapeVehicleHtmlFromUrl(url);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(url))
    );
  });

  it('hits the /api/scrape-html endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await scrapeVehicleHtmlFromUrl('https://example.com');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/scrape-html')
    );
  });

  it('returns error from payload when payload.ok is false', async () => {
    mockFetch({ ok: false, error: 'No og:image found' });
    const result = await scrapeVehicleHtmlFromUrl('https://example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('No og:image found');
  });

  it('returns fallback error when HTTP response is not ok', async () => {
    // payload.ok is true but HTTP status is an error — fallback to status message
    mockFetch({ ok: true, data: {} }, false, 502, 'Bad Gateway');
    const result = await scrapeVehicleHtmlFromUrl('https://example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('502');
      expect(result.error).toContain('Bad Gateway');
    }
  });

  it('returns error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));
    const result = await scrapeVehicleHtmlFromUrl('https://example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Failed to fetch');
  });

  it('returns string representation of non-Error throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('timeout'));
    const result = await scrapeVehicleHtmlFromUrl('https://example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('timeout');
  });
});
