import type { Vehicle } from './data';

export type ScrapeResult = {
  ok: true;
  data: Partial<Vehicle> & { specs?: Partial<Vehicle['specs']> };
} | {
  ok: false;
  error: string;
};

export async function scrapeVehicleHtmlFromUrl(url: string): Promise<ScrapeResult> {
  try {
    const response = await fetch(`/api/scrape-html?url=${encodeURIComponent(url)}`);
    const payload = await response.json() as ScrapeResult;
    if (!response.ok || !payload.ok) {
      return {
        ok: false,
        error: !payload.ok ? payload.error : `HTML scrape failed (${response.status} ${response.statusText}).`,
      };
    }
    return payload;
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
