// htmlScrape.ts — fetch page HTML via CORS proxy, send text to Gemini
// Use this for dealer listings where live prices/mileage matter.
// AI Fill (geminiScrape) uses Gemini's training knowledge and works without billing;
// HTML Fill fetches the actual page content for up-to-date listing details.

import { GoogleGenAI } from '@google/genai';
import type { Vehicle } from './data';
import { getGeminiConfig } from './geminiScrape';
import type { ScrapeResult } from './geminiScrape';

const CORS_PROXY = 'https://api.allorigins.win/get?url=';

const HTML_PROMPT = `You are extracting car listing details from the HTML text below.
Return ONLY a valid JSON object — no markdown fences, no explanation.
Omit any field you cannot find. Never fabricate values.

UNITS: All values must be in Canadian/metric units:
- Range / distance → kilometres (km)
- Dimensions → centimetres (cm)
- Cargo volume → litres (L)
- Torque → Newton-metres (Nm)
- Towing capacity → kilograms (kg)
- Fuel economy → litres per 100 km (L/100km)
- EV efficiency → litres equivalent per 100 km (Le/100km)
- Prices → CAD as shown on the page

PHOTO: Find the og:image meta tag value, or the src of the largest vehicle hero image.
Always return a fully-qualified absolute URL.

{
  "make": "string",
  "model": "string",
  "year": 0,
  "trim": "string",
  "powertrain": "gas" | "hybrid" | "ev",
  "bodyStyle": "Sedan" | "Coupe" | "Hatchback" | "SUV" | "Crossover" | "Truck" | "Minivan" | "Wagon",
  "condition": "New" | "Used" | "CPO",
  "mileage": 0,
  "color": "string",
  "dealer": "string",
  "photoUrl": "string (absolute URL)",
  "pricing": { "msrp": 0, "sellingPrice": 0, "discounts": 0, "incentives": 0, "fees": 0 },
  "finance":  { "apr": 0, "termMonths": 0 },
  "lease":    { "termMonths": 0, "residualPct": 0, "downPayment": 0, "annualKm": 0, "moneyFactor": 0 },
  "specs": {
    "engine": "string", "horsepower": 0, "torque": 0,
    "transmission": "string", "drivetrain": "string",
    "fuelL100km": 0, "mpge": 0, "evRange": 0, "batteryKwh": 0,
    "seating": 0, "cargoL": 0, "towingKg": 0,
    "lengthCm": 0, "legroomFront": 0, "legroomRear": 0, "groundClear": 0
  }
}`;

export async function scrapeVehicleHtmlFromUrl(url: string): Promise<ScrapeResult> {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) {
    return { ok: false, error: 'No Gemini API key set. Add VITE_GEMINI_API_KEY to your .env file and restart the dev server.' };
  }

  // 1. Fetch page via CORS proxy
  let html: string;
  try {
    const proxyRes = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`);
    if (!proxyRes.ok) throw new Error(`Proxy returned ${proxyRes.status}`);
    const json = await proxyRes.json();
    html = (json.contents as string) ?? '';
  } catch (err) {
    return { ok: false, error: `Could not fetch page: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (!html.trim()) {
    return { ok: false, error: 'Page returned empty content. The site may block proxies.' };
  }

  // 2. Strip scripts/styles, collapse whitespace, truncate to ~30k chars
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 30000);

  // 3. Send to Gemini
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: `${HTML_PROMPT}\n\nHTML TEXT:\n${clean}`,
      config: { temperature: 0 },
    });

    const text = response.text ?? '';
    const jsonMatch = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, error: 'Gemini returned no JSON. Try AI Fill instead.' };

    const raw = JSON.parse(jsonMatch[0]);
    return { ok: true, data: mapRawToVehicle(raw) };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function mapRawToVehicle(raw: Record<string, unknown>): Partial<Vehicle> & { specs?: Partial<Vehicle['specs']> } {
  const data: Partial<Vehicle> & { specs?: Partial<Vehicle['specs']> } = {};

  if (raw.make)       data.make       = raw.make as string;
  if (raw.model)      data.model      = raw.model as string;
  if (raw.year)       data.year       = Number(raw.year);
  if (raw.trim)       data.trim       = raw.trim as string;
  if (raw.powertrain) data.powertrain = raw.powertrain as Vehicle['powertrain'];
  if (raw.bodyStyle)  data.bodyStyle  = raw.bodyStyle as Vehicle['bodyStyle'];
  if (raw.condition)  data.condition  = raw.condition as Vehicle['condition'];
  if (raw.mileage)    data.mileage    = Number(raw.mileage);
  if (raw.color)      data.color      = raw.color as string;
  if (raw.dealer)     data.dealer     = raw.dealer as string;
  if (raw.photoUrl)   data.photoUrl   = raw.photoUrl as string;

  const pr = raw.pricing as Record<string, unknown> | undefined;
  if (pr) {
    data.pricing = {
      msrp: Number(pr.msrp) || 0, sellingPrice: Number(pr.sellingPrice) || 0,
      discounts: Number(pr.discounts) || 0, incentives: Number(pr.incentives) || 0,
      fees: Number(pr.fees) || 0, tradeValue: 0, taxRate: 0,
    };
  }

  const f = raw.finance as Record<string, unknown> | undefined;
  if (f?.apr || f?.termMonths) {
    data.finance = { apr: Number(f.apr) || 0, termMonths: Number(f.termMonths) || 60, downPayment: 0 };
  }

  const l = raw.lease as Record<string, unknown> | undefined;
  if (l?.termMonths || l?.moneyFactor) {
    data.lease = {
      termMonths: Number(l.termMonths) || 36, residualPct: Number(l.residualPct) || 0,
      downPayment: Number(l.downPayment) || 0, annualKm: Number(l.annualKm) || 20000,
      moneyFactor: Number(l.moneyFactor) || 0,
    };
  }

  const s = raw.specs as Record<string, unknown> | undefined;
  if (s) {
    data.specs = {};
    if (s.engine)       data.specs.engine       = s.engine as string;
    if (s.horsepower)   data.specs.horsepower   = Number(s.horsepower);
    if (s.torque)       data.specs.torque       = Number(s.torque);
    if (s.transmission) data.specs.transmission = s.transmission as string;
    if (s.drivetrain)   data.specs.drivetrain   = s.drivetrain as string;
    if (s.fuelL100km)   data.specs.fuelL100km   = Number(s.fuelL100km);
    if (s.mpge)         data.specs.mpge         = Number(s.mpge);
    if (s.evRange)      data.specs.evRange      = Number(s.evRange);
    if (s.batteryKwh)   data.specs.batteryKwh   = Number(s.batteryKwh);
    if (s.seating)      data.specs.seating      = Number(s.seating);
    if (s.cargoL)       data.specs.cargoL       = Number(s.cargoL);
    if (s.towingKg)     data.specs.towingKg     = Number(s.towingKg);
    if (s.lengthCm)     data.specs.lengthCm     = Number(s.lengthCm);
    if (s.legroomFront) data.specs.legroomFront = Number(s.legroomFront);
    if (s.legroomRear)  data.specs.legroomRear  = Number(s.legroomRear);
    if (s.groundClear)  data.specs.groundClear  = Number(s.groundClear);
  }

  return data;
}
