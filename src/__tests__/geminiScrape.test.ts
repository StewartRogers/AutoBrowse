import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must be declared with vi.hoisted so it's available inside the vi.mock factory (which is hoisted)
const mockGenerateContent = vi.hoisted(() => vi.fn());

vi.mock('@google/genai', () => ({
  // Must use a regular function (not arrow) so `new GoogleGenAI()` works
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return { models: { generateContent: mockGenerateContent } };
  }),
}));

// Import after mocks are set up
import { scrapeVehicleFromUrl, lookupVehicleSpecs } from '../lib/geminiScrape';

beforeEach(() => {
  vi.stubEnv('VITE_GEMINI_API_KEY', 'test-api-key');
  vi.stubEnv('VITE_GEMINI_MODEL', 'gemini-test');
  mockGenerateContent.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── helpers ────────────────────────────────────────────────────────────────

function geminiReturns(json: unknown) {
  mockGenerateContent.mockResolvedValue({ text: JSON.stringify(json) });
}

function geminiThrowsWithJson(errorJson: unknown) {
  mockGenerateContent.mockRejectedValue(new Error(JSON.stringify(errorJson)));
}

// ─── scrapeVehicleFromUrl ────────────────────────────────────────────────────

describe('scrapeVehicleFromUrl', () => {
  it('returns error immediately when API key is missing', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    const result = await scrapeVehicleFromUrl('https://example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('VITE_GEMINI_API_KEY');
    expect(mockGenerateContent).not.toHaveBeenCalled();
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

  it('parses pricing fields and coerces strings to numbers', async () => {
    geminiReturns({ pricing: { msrp: '45000', sellingPrice: '43000', discounts: 0, incentives: 0, fees: 0 } });
    const result = await scrapeVehicleFromUrl('https://example.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.pricing?.msrp).toBe(45000);
      expect(result.data.pricing?.sellingPrice).toBe(43000);
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
    mockGenerateContent.mockResolvedValue({ text: 'Sorry, I cannot find data for that URL.' });
    const result = await scrapeVehicleFromUrl('https://example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('no JSON');
  });

  it('returns error when response.text is null/undefined', async () => {
    mockGenerateContent.mockResolvedValue({ text: null });
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
    mockGenerateContent.mockRejectedValue(new Error('network timeout'));
    const result = await scrapeVehicleFromUrl('https://example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('network timeout');
  });
});

// ─── lookupVehicleSpecs ──────────────────────────────────────────────────────

describe('lookupVehicleSpecs', () => {
  it('returns error immediately when API key is missing', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    const result = await lookupVehicleSpecs(2024, 'Toyota', 'RAV4', 'XLE');
    expect(result.ok).toBe(false);
    expect(mockGenerateContent).not.toHaveBeenCalled();
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
    mockGenerateContent.mockResolvedValue({ text: 'No specs found.' });
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
