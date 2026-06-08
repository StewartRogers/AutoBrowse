import { GoogleGenAI } from '@google/genai';
import type { Vehicle } from './data';

const EXTRACT_PROMPT = `You are extracting car listing details from the webpage at this URL.
Return ONLY a valid JSON object (no markdown fences, no explanation).
Omit any field you cannot find — do not guess or fabricate values.

For photoUrl: use the og:image meta tag URL if present; otherwise use the src of the
largest/primary vehicle photo on the page. Always return a fully-qualified absolute URL.

{
  "make": "string",
  "model": "string",
  "year": 2024,
  "trim": "string",
  "powertrain": "gas" | "hybrid" | "ev",
  "bodyStyle": "Sedan" | "Coupe" | "Hatchback" | "SUV" | "Crossover" | "Truck" | "Minivan" | "Wagon",
  "condition": "New" | "Used" | "CPO",
  "mileage": 0,
  "color": "string (exterior color name)",
  "dealer": "string (dealership name)",
  "photoUrl": "string (absolute URL)",
  "pricing": {
    "msrp": 0,
    "sellingPrice": 0
  },
  "specs": {
    "engine": "string (e.g. '2.0L 4-Cyl Turbo' or '150kW Permanent Magnet Motor')",
    "horsepower": 0,
    "torque": 0,
    "transmission": "string (e.g. 'CVT' or '10-Speed Automatic')",
    "drivetrain": "string (e.g. 'AWD', 'FWD', 'RWD')",
    "mpgCombined": 0,
    "mpge": 0,
    "evRange": 0,
    "batteryKwh": 0,
    "seating": 0,
    "cargoCuFt": 0,
    "towingLbs": 0,
    "lengthIn": 0,
    "legroomFront": 0,
    "legroomRear": 0,
    "groundClear": 0
  }
}`;

export type ScrapeResult = {
  ok: true;
  data: Partial<Vehicle> & { specs?: Partial<Vehicle['specs']> };
} | {
  ok: false;
  error: string;
};

export function getGeminiConfig(): { apiKey: string; model: string } {
  return {
    apiKey: import.meta.env.VITE_GEMINI_API_KEY ?? '',
    model: import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash',
  };
}

export async function scrapeVehicleFromUrl(url: string): Promise<ScrapeResult> {
  const { apiKey, model } = getGeminiConfig();

  if (!apiKey) {
    return { ok: false, error: 'No Gemini API key set. Add VITE_GEMINI_API_KEY to your .env file and restart the dev server.' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model,
      contents: `${EXTRACT_PROMPT}\n\nURL: ${url}`,
      config: {
        tools: [{ urlContext: {} }],
        temperature: 0,
      },
    });

    const text = response.text ?? '';
    // Strip markdown fences if the model wraps anyway
    const jsonMatch = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, error: 'Gemini returned no JSON. The listing page may block scrapers.' };

    const raw = JSON.parse(jsonMatch[0]);

    const data: Partial<Vehicle> & { specs?: Partial<Vehicle['specs']> } = {};

    if (raw.make)       data.make       = raw.make;
    if (raw.model)      data.model      = raw.model;
    if (raw.year)       data.year       = Number(raw.year);
    if (raw.trim)       data.trim       = raw.trim;
    if (raw.powertrain) data.powertrain = raw.powertrain;
    if (raw.bodyStyle)  data.bodyStyle  = raw.bodyStyle;
    if (raw.condition)  data.condition  = raw.condition;
    if (raw.mileage)    data.mileage    = Number(raw.mileage);
    if (raw.color)      data.color      = raw.color;
    if (raw.dealer)     data.dealer     = raw.dealer;
    if (raw.photoUrl)   data.photoUrl   = raw.photoUrl;
    if (raw.pricing) {
      data.pricing = {
        msrp: Number(raw.pricing.msrp) || 0,
        sellingPrice: Number(raw.pricing.sellingPrice) || 0,
        discounts: 0, incentives: 0, tradeValue: 0, taxRate: 0, fees: 0,
      };
    }
    if (raw.specs) {
      data.specs = {};
      const s = raw.specs;
      if (s.engine)        data.specs.engine        = s.engine;
      if (s.horsepower)    data.specs.horsepower    = Number(s.horsepower);
      if (s.torque)        data.specs.torque        = Number(s.torque);
      if (s.transmission)  data.specs.transmission  = s.transmission;
      if (s.drivetrain)    data.specs.drivetrain    = s.drivetrain;
      if (s.mpgCombined)   data.specs.mpgCombined   = Number(s.mpgCombined);
      if (s.mpge)          data.specs.mpge          = Number(s.mpge);
      if (s.evRange)       data.specs.evRange       = Number(s.evRange);
      if (s.batteryKwh)    data.specs.batteryKwh    = Number(s.batteryKwh);
      if (s.seating)       data.specs.seating       = Number(s.seating);
      if (s.cargoCuFt)     data.specs.cargoCuFt     = Number(s.cargoCuFt);
      if (s.towingLbs)     data.specs.towingLbs     = Number(s.towingLbs);
      if (s.lengthIn)      data.specs.lengthIn      = Number(s.lengthIn);
      if (s.legroomFront)  data.specs.legroomFront  = Number(s.legroomFront);
      if (s.legroomRear)   data.specs.legroomRear   = Number(s.legroomRear);
      if (s.groundClear)   data.specs.groundClear   = Number(s.groundClear);
    }

    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
