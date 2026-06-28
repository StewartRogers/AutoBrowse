import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { scrapeVehicleFromUrl, lookupVehicleSpecs } from '../lib/geminiScrape';

// The client no longer talks to the Gemini SDK directly — the API key lives only on
// the server. The client POSTs the prompt to /api/gemini and gets back { ok, text }.
// So we mock global fetch to stand in for that server proxy.
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── helpers ────────────────────────────────────────────────────────────────

// Proxy succeeded and Gemini returned the given JSON object as its text.
function geminiReturns(json: unknown) {
  fetchMock.mockResolvedValue({ json: async () => ({ ok: true, text: JSON.stringify(json) }) });
}

// Proxy succeeded but Gemini returned raw (non-JSON) text.
function geminiReturnsText(text: unknown) {
  fetchMock.mockResolvedValue({ json: async () => ({ ok: true, text }) });
}

// Proxy reported a failure (the server forwards Gemini's error message verbatim).
function proxyError(errorMessage: string) {
  fetchMock.mockResolvedValue({ json: async () => ({ ok: false, error: errorMessage }) });
}

function geminiThrowsWithJson(errorJson: unknown) {
  proxyError(JSON.stringify(errorJson));
}

// ─── scrapeVehicleFromUrl ────────────────────────────────────────────────────

describe('scrapeVehicleFromUrl', () => {
  it('surfaces the server error when the API key is missing on the server', async () => {
    proxyError('Server is missing GEMINI_API_KEY. Set it in the environment (no VITE_ prefix).');
    const result = await scrapeVehicleFromUrl('https://example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('GEMINI_API_KEY');
    expect(fetchMock).toHaveBeenCalledWith('/api/gemini', expect.objectContaining({ method: 'POST' }));
  });

  it('parses top-level vehicle fields from JSON response', async () => {
    geminiReturns({ make: 'Toyota', model: 'RAV4', year: 2024, trim: 'XLE', powertrain: 'gas' });
    const result = await scrapeVehicleFromUrl('https://example.com/rav4');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.make).toBe('Toyota');
      expect(result.data.model).toBe('RAV4');
      expect(result.data.year).toBe(2024);
      expect(result.data.trim).toBe('XLE');
      expect(result.data.powertrain).toBe('gas');
    }
  });

  it('parses pricing fields and derives discount from msrp − sellingPrice', async () => {
    geminiReturns({ pricing: { msrp: '45000', sellingPrice: '43000', discounts: 0, incentives: 0, fees: 600 } });
    const result = await scrapeVehicleFromUrl('https://example.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.pricing?.msrp).toBe(45000);
      expect(result.data.pricing?.discount).toBe(2000); // 45000 − 43000 (selling price is derived)
      expect(result.data.pricing?.fees?.[0]).toMatchObject({ type: 'documentation', amount: 600, gst: true, pst: true, taxOverridden: false });
    }
  });

  it('parses specs fields and coerces strings to numbers', async () => {
    geminiReturns({ specs: { horsepower: '203', torque: '184', engine: '2.5L 4-cyl' } });
    const result = await scrapeVehicleFromUrl('https://example.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.specs?.horsepower).toBe(203);
      expect(result.data.specs?.torque).toBe(184);
      expect(result.data.specs?.engine).toBe('2.5L 4-cyl');
    }
  });

  it('parses boolean features', async () => {
    geminiReturns({ features: { sunroof: true, backupCamera: true, heatedSteeringWheel: false } });
    const result = await scrapeVehicleFromUrl('https://example.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.features?.sunroof).toBe(true);
      expect(result.data.features?.backupCamera).toBe(true);
      expect(result.data.features?.heatedSteeringWheel).toBe(false);
    }
  });

  it('parses heatedSeats enum values', async () => {
    geminiReturns({ features: { heatedSeats: 'front+rear', cooledSeats: 'front', powerSeats: 'both' } });
    const result = await scrapeVehicleFromUrl('https://example.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.features?.heatedSeats).toBe('front+rear');
      expect(result.data.features?.cooledSeats).toBe('front');
      expect(result.data.features?.powerSeats).toBe('both');
    }
  });

  it('maps invalid enum values to null', async () => {
    geminiReturns({ features: { heatedSeats: 'rear-only', interiorMaterial: 'velvet' } });
    const result = await scrapeVehicleFromUrl('https://example.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.features?.heatedSeats).toBeNull();
      expect(result.data.features?.interiorMaterial).toBeNull();
    }
  });

  it('returns error when Gemini response contains no JSON', async () => {
    geminiReturnsText('Sorry, I cannot find data for that URL.');
    const result = await scrapeVehicleFromUrl('https://example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('no JSON');
  });

  it('returns error when proxy text is null/undefined', async () => {
    geminiReturnsText(null);
    const result = await scrapeVehicleFromUrl('https://example.com');
    expect(result.ok).toBe(false);
  });

  it('returns friendly rate-limit message on 429 error', async () => {
    geminiThrowsWithJson({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'quota exceeded' } });
    const result = await scrapeVehicleFromUrl('https://example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Rate limit');
  });

  it('returns friendly auth message on 401 error', async () => {
    geminiThrowsWithJson({ error: { code: 401, message: 'Invalid API key' } });
    const result = await scrapeVehicleFromUrl('https://example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('API key rejected');
  });

  it('returns friendly auth message on 403 error', async () => {
    geminiThrowsWithJson({ error: { code: 403, message: 'Forbidden' } });
    const result = await scrapeVehicleFromUrl('https://example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('API key rejected');
  });

  it('returns friendly model-not-found message on 404 error', async () => {
    geminiThrowsWithJson({ error: { code: 404, message: 'Model not found' } });
    const result = await scrapeVehicleFromUrl('https://example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Model not found');
  });

  it('returns raw error message when no JSON in the error', async () => {
    proxyError('network timeout');
    const result = await scrapeVehicleFromUrl('https://example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('network timeout');
  });
});

// ─── lookupVehicleSpecs ──────────────────────────────────────────────────────

describe('lookupVehicleSpecs', () => {
  it('surfaces the server error when the API key is missing on the server', async () => {
    proxyError('Server is missing GEMINI_API_KEY. Set it in the environment (no VITE_ prefix).');
    const result = await lookupVehicleSpecs(2024, 'Toyota', 'RAV4', 'XLE');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('GEMINI_API_KEY');
  });

  it('parses specs and coerces numeric strings', async () => {
    geminiReturns({
      powertrain: 'gas',
      bodyStyle: 'SUV',
      specs: { horsepower: '203', evRange: 0, engine: '2.5L 4-cyl', seating: '5' },
    });
    const result = await lookupVehicleSpecs(2024, 'Toyota', 'RAV4', 'XLE');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.powertrain).toBe('gas');
      expect(result.data.bodyStyle).toBe('SUV');
      expect(result.data.specs.horsepower).toBe(203);
      expect(result.data.specs.engine).toBe('2.5L 4-cyl');
    }
  });

  it('omits zero-valued numeric specs (falsy guard)', async () => {
    // The implementation uses `if (s.evRange)` so zero values are not set
    geminiReturns({ specs: { horsepower: 203, evRange: 0 } });
    const result = await lookupVehicleSpecs(2024, 'Toyota', 'RAV4', 'XLE');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.specs.horsepower).toBe(203);
      expect(result.data.specs.evRange).toBeUndefined();
    }
  });

  it('includes photoUrl when returned', async () => {
    geminiReturns({ photoUrl: 'https://cdn.example.com/rav4.jpg', specs: {} });
    const result = await lookupVehicleSpecs(2024, 'Toyota', 'RAV4', 'XLE');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.photoUrl).toBe('https://cdn.example.com/rav4.jpg');
  });

  it('returns error when Gemini response has no JSON', async () => {
    geminiReturnsText('No specs found.');
    const result = await lookupVehicleSpecs(2024, 'Toyota', 'RAV4', 'XLE');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('No specs returned');
  });

  it('returns friendly rate-limit message on quota error', async () => {
    geminiThrowsWithJson({ error: { code: 429, status: 'RESOURCE_EXHAUSTED' } });
    const result = await lookupVehicleSpecs(2024, 'Toyota', 'RAV4', 'XLE');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Rate limit');
  });
});
