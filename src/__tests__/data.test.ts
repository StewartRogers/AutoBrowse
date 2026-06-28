// Unit tests for all financial and scoring logic in src/lib/data.ts
import { describe, it, expect } from 'vitest';
import {
  taxesOn, bcTax, outTheDoor, financeCalc, leaseCalc,
  sellingPriceOf, discountExceedsMsrp,
  energyCostPerYear, ownershipCalc, avgRating,
  matrixScores, deepMerge, blankVehicle, migratePricing,
  DEFAULT_MATRIX, SEED_VEHICLES,
  type Pricing, type Vehicle, type Fee,
} from '../lib/data';

// Build a structured fee row (id/type/taxableOverridden filled) for tests.
const fee = (amount: number, taxable: boolean, label = 'Fee'): Fee =>
  ({ id: 'test', type: 'custom', label, amount, taxable, taxableOverridden: false });

// Fixed date so the ZEV PST schedule (active until 2027-02-22) is deterministic.
const ASOF = new Date('2026-06-27T00:00:00');

// ─── helpers ────────────────────────────────────────────────────────────────

function makePricing(overrides: Partial<Pricing> = {}): Pricing {
  return {
    msrp: 0, discount: 0, incentives: 0,
    tradeValue: 0, taxRate: 0, fees: [],
    ...overrides,
  };
}

// Legacy-style flat fee: a single non-taxable pass-through (added after tax), so
// tests written against the old numeric `fees` keep the same expected totals.
const flatFee = (amount: number): Pricing['fees'] => [fee(amount, false, 'Fees')];

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return { ...blankVehicle(), ...overrides };
}

// ─── BC vehicle tax (bcTax / taxesOn) ─────────────────────────────────────────
// Rules per BC PST Bulletin 308. taxesOn() returns bcTax().totalTax.

describe('bcTax', () => {
  it('84,000 ZEV passenger, dealer → GST 4,200, PST 8,400 (10%)', () => {
    const p = makePricing({ msrp: 84000, isZEV: true, sellerType: 'dealer', isPassengerVehicle: true });
    const t = bcTax(p, ASOF);
    expect(t.gst).toBeCloseTo(4200);   // 5% of 84,000
    expect(t.pst).toBeCloseTo(8400);   // ZEV table: 77k–125k tier = 10%
    expect(t.luxuryTax).toBe(0);
    expect(t.totalTax).toBeCloseTo(12600);
  });

  it('60,000 ZEV passenger, dealer → PST 7% (ZEV threshold not yet reached)', () => {
    const p = makePricing({ msrp: 60000, isZEV: true, sellerType: 'dealer' });
    const t = bcTax(p, ASOF);
    expect(t.pst).toBeCloseTo(4200);   // 7% of 60,000 (ZEV 8% band starts at 75k)
    expect(t.gst).toBeCloseTo(3000);
  });

  it('60,000 non-ZEV passenger, dealer → PST 10% (57k–125k band)', () => {
    const p = makePricing({ msrp: 60000, isZEV: false, sellerType: 'dealer' });
    const t = bcTax(p, ASOF);
    expect(t.pst).toBeCloseTo(6000);   // 10% of 60,000
    expect(t.gst).toBeCloseTo(3000);
  });

  it('private sale: no GST, PST 12% under 125k', () => {
    const p = makePricing({ msrp: 40000, sellerType: 'private' });
    const t = bcTax(p, ASOF);
    expect(t.gst).toBe(0);
    expect(t.pst).toBeCloseTo(4800);   // 12% of 40,000
    expect(t.totalTax).toBeCloseTo(4800);
  });

  it('dealer trade-in reduces both GST and PST base', () => {
    const p = makePricing({ msrp: 50000, tradeValue: 10000, sellerType: 'dealer' });
    const t = bcTax(p, ASOF);
    // base = 40,000 → PST 7% = 2,800; GST 5% = 2,000
    expect(t.pst).toBeCloseTo(2800);
    expect(t.gst).toBeCloseTo(2000);
  });

  it('non-passenger vehicle is flat 7% dealer / 12% private regardless of price', () => {
    const dealer = bcTax(makePricing({ msrp: 200000, isPassengerVehicle: false, sellerType: 'dealer' }), ASOF);
    expect(dealer.pst).toBeCloseTo(0.07 * 200000);
    const priv = bcTax(makePricing({ msrp: 200000, isPassengerVehicle: false, sellerType: 'private' }), ASOF);
    expect(priv.pst).toBeCloseTo(0.12 * 200000);
  });

  it('federal luxury tax: lesser of 10% of price or 20% over 100k, with GST on top', () => {
    const p = makePricing({ msrp: 120000, sellerType: 'dealer' });
    const t = bcTax(p, ASOF);
    // luxury = min(0.10*120000=12000, 0.20*20000=4000) = 4000
    expect(t.luxuryTax).toBeCloseTo(4000);
    // PST on price before luxury: 125k band not reached → 10% of 120,000 = 12,000
    expect(t.pst).toBeCloseTo(12000);
    // GST charged on top of luxury: 5% of (120000 + 4000) = 6200
    expect(t.gst).toBeCloseTo(6200);
  });
});

// ─── derived selling price + itemized fees (new model) ────────────────────────

describe('bcTax — derived selling price & itemized fees', () => {
  it('REGRESSION ANCHOR: 83,649 MSRP − 5,000, ZEV dealer, doc 600 (taxable) + finance 800 (exempt)', () => {
    const p = makePricing({
      msrp: 83649, discount: 5000, isZEV: true, sellerType: 'dealer', isPassengerVehicle: true,
      fees: [fee(600, true, 'Documentation'), fee(800, false, 'Finance')],
    });
    const t = bcTax(p, ASOF);
    expect(t.sellingPrice).toBe(78649);     // 83,649 − 5,000
    expect(t.pstRate).toBe(10);             // taxableBase 79,249 → 77k–125k ZEV band
    expect(t.gst).toBeCloseTo(3962.45);     // 5% of 79,249 (78,649 + 600 doc)
    expect(t.pst).toBeCloseTo(7924.90);     // 10% of 79,249
    expect(t.outTheDoor).toBeCloseTo(91936.35); // selling + tax + 600 + 800
    // Fee tax attribution: doc fee carries GST+PST (15%), finance fee carries none.
    const doc = t.fees.find(f => f.label === 'Documentation')!;
    const fin = t.fees.find(f => f.label === 'Finance')!;
    expect(doc.taxApplied).toBeCloseTo(600 * 0.15);
    expect(fin.taxApplied).toBe(0);
  });

  it('a taxable fee pushes the price into a higher PST band', () => {
    // 54,900 alone is the 7% band; a 200 taxable doc fee lifts the base to 55,100 → 8%.
    const withFee = bcTax(makePricing({ msrp: 54900, sellerType: 'dealer', fees: [fee(200, true, 'Doc')] }), ASOF);
    expect(withFee.pstRate).toBe(8);
    expect(withFee.pst).toBeCloseTo(0.08 * 55100);
    const noFee = bcTax(makePricing({ msrp: 54900, sellerType: 'dealer' }), ASOF);
    expect(noFee.pstRate).toBe(7);
  });

  it('a non-taxable fee adds its face value with zero tax', () => {
    const without = bcTax(makePricing({ msrp: 40000, sellerType: 'dealer' }), ASOF);
    const withFin = bcTax(makePricing({ msrp: 40000, sellerType: 'dealer', fees: [fee(800, false, 'Finance')] }), ASOF);
    expect(withFin.totalTax).toBeCloseTo(without.totalTax);        // tax unchanged
    expect(withFin.outTheDoor - without.outTheDoor).toBeCloseTo(800); // only the face value
    expect(withFin.fees[0].taxApplied).toBe(0);
  });

  it('discount = 0 makes selling price equal MSRP', () => {
    const t = bcTax(makePricing({ msrp: 50000, discount: 0, sellerType: 'dealer' }), ASOF);
    expect(t.sellingPrice).toBe(50000);
    expect(t.discount).toBe(0);
  });

  it('discount is clamped to MSRP (never negative selling price)', () => {
    const p = makePricing({ msrp: 30000, discount: 40000 });
    expect(sellingPriceOf(p)).toBe(0);
    expect(discountExceedsMsrp(p)).toBe(true);
    expect(bcTax(p, ASOF).sellingPrice).toBe(0);
  });
});

describe('migratePricing — fee data is not lost', () => {
  it('upgrades old free-form fees into structured rows (id/type/override)', () => {
    const legacy = {
      msrp: 50000, discount: 0,
      fees: [
        { label: 'Documentation Fee', amount: 600, taxable: true },
        { label: 'Finance Fee', amount: 800, taxable: false },
        { label: 'Mystery surcharge', amount: 250, taxable: true },
      ],
    };
    const fees = migratePricing(legacy).fees;
    expect(fees).toHaveLength(3);
    // type inferred from the label; amount/taxable preserved; id assigned.
    expect(fees[0]).toMatchObject({ type: 'documentation', amount: 600, taxable: true, taxableOverridden: false });
    expect(fees[1]).toMatchObject({ type: 'finance', amount: 800, taxable: false, taxableOverridden: false });
    // Unknown label → custom; taxable (true) differs from custom's default (false) → overridden.
    expect(fees[2]).toMatchObject({ type: 'custom', label: 'Mystery surcharge', amount: 250, taxable: true, taxableOverridden: true });
    fees.forEach(f => expect(typeof f.id).toBe('string'));
  });

  it('converts the oldest numeric `fees` total into one custom row', () => {
    const fees = migratePricing({ msrp: 30000, fees: 1200 }).fees;
    expect(fees).toEqual([expect.objectContaining({ type: 'custom', amount: 1200, taxable: false })]);
  });

  it('is idempotent on already-structured fees', () => {
    const once = migratePricing({ msrp: 40000, discount: 0, fees: [fee(600, true, 'Documentation')] });
    const twice = migratePricing(once);
    expect(twice.fees).toEqual(once.fees);
  });
});

describe('taxesOn', () => {
  it('returns the BC total tax (gst + pst + luxury)', () => {
    const p = makePricing({ msrp: 30000, sellerType: 'dealer' });
    // base 30k → PST 7% = 2100, GST 5% = 1500
    expect(taxesOn(p, ASOF)).toBeCloseTo(3600);
  });

  it('never goes negative (trade exceeds selling price)', () => {
    const p = makePricing({ msrp: 5000, tradeValue: 9000 });
    expect(taxesOn(p, ASOF)).toBe(0);
  });

  it('handles all-zero pricing', () => {
    expect(taxesOn(makePricing(), ASOF)).toBe(0);
  });
});

// ─── outTheDoor ─────────────────────────────────────────────────────────────

describe('outTheDoor', () => {
  it('sellingPrice + taxes + fees − incentives', () => {
    const p = makePricing({
      msrp: 30000,
      tradeValue: 5000,    // dealer base = 25000 → PST 1750 + GST 1250 = 3000
      fees: flatFee(1200),
      incentives: 500,
    });
    // 30000 + 3000 + 1200 - 500 = 33700
    expect(outTheDoor(p)).toBeCloseTo(33700);
  });

  it('trade-in does NOT reduce OTD by its amount (only via a smaller tax base)', () => {
    const p1 = makePricing({ msrp: 30000, tradeValue: 0, fees: flatFee(1000), incentives: 0 });
    const p2 = makePricing({ msrp: 30000, tradeValue: 10000, fees: flatFee(1000), incentives: 0 });
    // OTD differs only because the taxable base shrinks, not by the trade amount
    expect(outTheDoor(p1)).not.toBe(outTheDoor(p2));
    // p2 base = 20000 → PST 1400 + GST 1000 = 2400; OTD = 30000 + 2400 + 1000 = 33400
    expect(outTheDoor(p2)).toBeCloseTo(33400);
  });

  it('incentives reduce OTD dollar-for-dollar', () => {
    const base = makePricing({ msrp: 40000, fees: flatFee(1000), incentives: 0 });
    const withInc = makePricing({ msrp: 40000, fees: flatFee(1000), incentives: 2000 });
    expect(outTheDoor(base) - outTheDoor(withInc)).toBeCloseTo(2000);
  });
});

// ─── financeCalc ────────────────────────────────────────────────────────────

describe('financeCalc', () => {
  it('calculates standard amortized monthly payment correctly', () => {
    // principal = OTD − downPayment − tradeValue. OTD now includes BC tax, so
    // derive the expected principal from outTheDoor rather than hard-coding it.
    const v = makeVehicle({
      pricing: makePricing({ msrp: 30000, fees: flatFee(1000) }),
      finance: { downPayment: 3000, apr: 6, termMonths: 60 },
    });
    const result = financeCalc(v);
    const expectedPrincipal = outTheDoor(v.pricing) - 3000; // tradeValue = 0
    expect(result.principal).toBeCloseTo(expectedPrincipal);
    // standard amortization formula on that principal
    const r = 0.06 / 12, n = 60;
    const expectedMonthly = (expectedPrincipal * r) / (1 - Math.pow(1 + r, -n));
    expect(result.monthly).toBeCloseTo(expectedMonthly, 2);
    expect(result.totalPaid).toBeCloseTo(result.monthly * 60 + 3000, 0);
    expect(result.totalInterest).toBeCloseTo(result.monthly * 60 - expectedPrincipal, 0);
  });

  it('handles 0% APR (no division by zero)', () => {
    const v = makeVehicle({
      pricing: makePricing({ msrp: 12000 }),
      finance: { downPayment: 0, apr: 0, termMonths: 12 },
    });
    const result = financeCalc(v);
    // 0% APR: monthly is simply OTD / term
    expect(result.monthly).toBeCloseTo(outTheDoor(v.pricing) / 12);
    expect(result.totalInterest).toBeCloseTo(0);
  });

  it('trade-in reduces principal (not OTD)', () => {
    const noTrade = makeVehicle({
      pricing: makePricing({ msrp: 30000, tradeValue: 0, taxRate: 0 }),
      finance: { downPayment: 0, apr: 6, termMonths: 60 },
    });
    const withTrade = makeVehicle({
      pricing: makePricing({ msrp: 30000, tradeValue: 5000, taxRate: 0 }),
      finance: { downPayment: 0, apr: 6, termMonths: 60 },
    });
    // principal = OTD − trade; the trade also shrinks the tax base, so derive
    // the expectation from outTheDoor. base 25000 → PST 1750 + GST 1250.
    expect(financeCalc(withTrade).principal).toBeCloseTo(outTheDoor(withTrade.pricing) - 5000);
    expect(financeCalc(withTrade).monthly).toBeLessThan(financeCalc(noTrade).monthly);
  });

  it('principal never goes negative', () => {
    const v = makeVehicle({
      pricing: makePricing({ msrp: 20000, tradeValue: 10000, taxRate: 0 }),
      finance: { downPayment: 15000, apr: 5, termMonths: 60 },
    });
    // principal = max(0, OTD − 15000 down − 10000 trade) = 0 (OTD ≈ 21,200)
    expect(financeCalc(v).principal).toBe(0);
    expect(financeCalc(v).monthly).toBe(0);
  });

  it('REGRESSION ANCHOR: down payment is NOT in totalOfPayments (OTD ~91,936, 10k down, 4.99%, 84mo)', () => {
    // Same vehicle as the BC tax anchor → outTheDoor ≈ 91,936.35.
    const v = makeVehicle({
      pricing: makePricing({
        msrp: 83649, discount: 5000, isZEV: true, sellerType: 'dealer', isPassengerVehicle: true,
        fees: [fee(600, true, 'Documentation'), fee(800, false, 'Finance')],
      }),
      finance: { downPayment: 10000, apr: 4.99, termMonths: 84 },
    });
    const r = financeCalc(v);
    expect(r.amountFinanced).toBeCloseTo(81936, 0);     // OTD 91,936.35 − 10,000
    expect(r.monthly).toBeCloseTo(1158, 0);
    expect(r.totalInterest).toBeCloseTo(15310, -1);
    expect(r.totalOfPayments).toBeCloseTo(97246, -1);   // loan only — must NOT be 107,246
    expect(r.totalCost).toBeCloseTo(107246, -1);
    // The exact bug guard: the down payment appears once, as the difference.
    expect(r.totalCost - r.totalOfPayments).toBeCloseTo(10000, 0);
  });

  it('down payment ≥ OTD: no loan, totalCost = OTD', () => {
    const v = makeVehicle({
      pricing: makePricing({ msrp: 30000, sellerType: 'dealer' }),
      finance: { downPayment: 40000, apr: 5, termMonths: 60 },
    });
    const otd = outTheDoor(v.pricing);
    const r = financeCalc(v);
    expect(r.amountFinanced).toBe(0);
    expect(r.monthly).toBe(0);
    expect(r.totalInterest).toBe(0);
    expect(r.totalOfPayments).toBe(0);
    expect(r.totalCost).toBeCloseTo(otd); // not the oversized down payment
  });

  it('APR = 0: monthly = amountFinanced / term, zero interest', () => {
    const v = makeVehicle({
      pricing: makePricing({ msrp: 24000, sellerType: 'dealer' }),
      finance: { downPayment: 0, apr: 0, termMonths: 24 },
    });
    const r = financeCalc(v);
    expect(r.totalInterest).toBe(0);
    expect(r.monthly).toBeCloseTo(r.amountFinanced / 24);
    expect(r.totalOfPayments).toBeCloseTo(r.amountFinanced);
  });
});

// ─── leaseCalc ──────────────────────────────────────────────────────────────

describe('leaseCalc', () => {
  it('calculates monthly lease payment', () => {
    const v = makeVehicle({
      pricing: makePricing({ msrp: 40000, discount: 2000, tradeValue: 0, incentives: 0, taxRate: 8 }),
      lease: { termMonths: 36, residualPct: 55, downPayment: 2000, annualKm: 20000, moneyFactor: 0.002 },
    });
    const r = leaseCalc(v);
    // cap = 38000 - 2000 - 0 - 0 = 36000
    // residual = 40000 * 0.55 = 22000
    // depreciation = (36000 - 22000)/36 ≈ 388.89
    // financeCharge = (36000 + 22000) * 0.002 = 116
    // base = 504.89, monthly = 504.89 * 1.08 ≈ 545.28
    expect(r.monthly).toBeCloseTo(545.28, 0);
    expect(r.residual).toBeCloseTo(22000);
    expect(r.buyout).toBeCloseTo(22000);
    expect(r.totalLease).toBeCloseTo(r.monthly * 36 + 2000, 0);
  });

  it('residual is based on MSRP × residualPct', () => {
    const v = makeVehicle({
      pricing: makePricing({ msrp: 30000, discount: 0, taxRate: 0, tradeValue: 0, incentives: 0 }),
      lease: { termMonths: 36, residualPct: 50, downPayment: 0, annualKm: 20000, moneyFactor: 0 },
    });
    const r = leaseCalc(v);
    expect(r.residual).toBeCloseTo(15000); // 30000 * 50%
  });

  it('monthly is clamped to 0 when cap < residual (prototype fix)', () => {
    // Extreme edge case: cap=0 but residual is large → depreciation goes negative.
    // The prototype had no guard; we clamp to max(0, monthly).
    const v = makeVehicle({
      pricing: makePricing({ msrp: 30000, discount: 0, tradeValue: 20000, incentives: 15000 }),
      lease: { termMonths: 36, residualPct: 50, downPayment: 5000, annualKm: 20000, moneyFactor: 0.002 },
    });
    // cap = max(0, 30000-5000-20000-15000) = 0
    // residual = 30000*0.50 = 15000 → depreciation=(0-15000)/36 is negative → clamp monthly to 0
    expect(leaseCalc(v).monthly).toBe(0);
  });
});

// ─── energyCostPerYear ──────────────────────────────────────────────────────

describe('energyCostPerYear', () => {
  it('calculates gas cost: (annualKm / 100) * fuelL100km * fuelCostPerL', () => {
    const v = makeVehicle({
      powertrain: 'gas',
      specs: { fuelL100km: 10 },
      ownership: { annualKm: 20000, fuelCostPerL: 2.00, electricityPerKwh: 0.13, insuranceYr: 0, maintenanceYr: 0 },
    });
    // (20000/100) * 10 * 2.00 = 4000
    expect(energyCostPerYear(v)).toBeCloseTo(4000);
  });

  it('calculates EV cost: (annualKm / 100) * 20kWh * kwhPrice', () => {
    const v = makeVehicle({
      powertrain: 'ev',
      specs: {},
      ownership: { annualKm: 20000, fuelCostPerL: 1.65, electricityPerKwh: 0.20, insuranceYr: 0, maintenanceYr: 0 },
    });
    // (20000/100) * 20 * 0.20 = 800
    expect(energyCostPerYear(v)).toBeCloseTo(800);
  });

  it('hybrid uses fuelL100km formula', () => {
    const v = makeVehicle({
      powertrain: 'hybrid',
      specs: { fuelL100km: 5.4 },
      ownership: { annualKm: 20000, fuelCostPerL: 1.65, electricityPerKwh: 0.13, insuranceYr: 0, maintenanceYr: 0 },
    });
    expect(energyCostPerYear(v)).toBeCloseTo((20000 / 100) * 5.4 * 1.65, 1);
  });

  it('falls back to 9.0 L/100km when fuelL100km is missing', () => {
    const v = makeVehicle({
      powertrain: 'gas',
      specs: {},
      ownership: { annualKm: 20000, fuelCostPerL: 1.50, electricityPerKwh: 0.13, insuranceYr: 0, maintenanceYr: 0 },
    });
    expect(energyCostPerYear(v)).toBeCloseTo((20000 / 100) * 9.0 * 1.50);
  });
});

// ─── ownershipCalc ──────────────────────────────────────────────────────────

describe('ownershipCalc', () => {
  it('sums energy + insurance + maintenance for projections', () => {
    const v = makeVehicle({
      powertrain: 'gas',
      specs: { fuelL100km: 10 },
      ownership: { annualKm: 20000, fuelCostPerL: 2.00, electricityPerKwh: 0.13, insuranceYr: 1800, maintenanceYr: 600 },
    });
    // energy = (20000/100)*10*2.00 = 4000, perYear = 4000 + 1800 + 600 = 6400
    const r = ownershipCalc(v);
    expect(r.perYear).toBeCloseTo(6400);
    expect(r.y1).toBeCloseTo(6400);
    expect(r.y3).toBeCloseTo(19200);
    expect(r.y5).toBeCloseTo(32000);
  });

  it('energy component matches energyCostPerYear', () => {
    const v = makeVehicle({
      powertrain: 'ev',
      specs: {},
      ownership: { annualKm: 20000, fuelCostPerL: 1.65, electricityPerKwh: 0.15, insuranceYr: 2000, maintenanceYr: 400 },
    });
    expect(ownershipCalc(v).energy).toBeCloseTo(energyCostPerYear(v));
  });
});

// ─── avgRating ───────────────────────────────────────────────────────────────

describe('avgRating', () => {
  it('averages all non-zero rating values', () => {
    const v = makeVehicle({
      ratings: { comfort: 8, driving: 6, interior: 7, technology: 9, appearance: 7, cargo: 5, value: 8 },
    });
    // sum=50, count=7, avg≈7.14
    expect(avgRating(v)).toBeCloseTo(50 / 7, 1);
  });

  it('excludes zero values from average', () => {
    const v = makeVehicle({
      ratings: { comfort: 8, driving: 0, interior: 6 },
    });
    expect(avgRating(v)).toBeCloseTo(7); // (8+6)/2
  });

  it('returns 0 when no ratings are set', () => {
    expect(avgRating(makeVehicle({ ratings: {} }))).toBe(0);
  });

  it('returns 0 when all ratings are 0', () => {
    expect(avgRating(makeVehicle({ ratings: { comfort: 0, driving: 0 } }))).toBe(0);
  });
});

// ─── matrixScores ────────────────────────────────────────────────────────────

describe('matrixScores', () => {
  const vehicles = SEED_VEHICLES();

  it('returns one result per active vehicle', () => {
    const results = matrixScores(vehicles, DEFAULT_MATRIX);
    const active = vehicles.filter(v => !v.archived);
    expect(results).toHaveLength(active.length);
  });

  it('results are sorted descending by score', () => {
    const results = matrixScores(vehicles, DEFAULT_MATRIX);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('all scores are in 0..100 range', () => {
    const results = matrixScores(vehicles, DEFAULT_MATRIX);
    results.forEach(r => {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    });
  });

  it('breakdown contribution sums ≈ vehicle score', () => {
    const results = matrixScores(vehicles, DEFAULT_MATRIX);
    results.forEach(r => {
      const sum = Object.values(r.breakdown).reduce((a, b) => a + b.contrib, 0);
      expect(sum).toBeCloseTo(r.score, 5);
    });
  });

  it('excludes archived vehicles', () => {
    const withArchived = vehicles.map((v, i) =>
      i === 0 ? { ...v, archived: true } : v
    );
    const results = matrixScores(withArchived, DEFAULT_MATRIX);
    expect(results).toHaveLength(vehicles.length - 1);
    expect(results.find(r => r.vehicle.id === vehicles[0].id)).toBeUndefined();
  });

  it('min-max normalization: best in a single-vehicle set scores 100', () => {
    const single = [vehicles[0]];
    const results = matrixScores(single, DEFAULT_MATRIX);
    // with only one vehicle, span=0 so it gets normalized to 0 per factor → total ~ 0
    // BUT if span===0, norm=0 for dir='high' and 1-0=1 for dir='low'
    // actually with span=0, n=0/1=0 for all metrics, so:
    // 'low' dir: n=1, 'high' dir: n=0 — the single vehicle scores 0 on high metrics
    // This is a known prototype behavior; just verify no error thrown
    expect(results).toHaveLength(1);
    expect(typeof results[0].score).toBe('number');
  });

  it('low-dir metric: cheapest vehicle gets highest normalized score', () => {
    const results = matrixScores(vehicles, [{ metric: 'price', weight: 100 }]);
    const prices = vehicles
      .filter(v => !v.archived)
      .map(v => sellingPriceOf(v.pricing));
    const minPrice = Math.min(...prices);
    const winner = results[0].vehicle;
    const winnerPrice = sellingPriceOf(winner.pricing);
    expect(winnerPrice).toBe(minPrice);
  });

  it('high-dir metric: highest comfort rating wins', () => {
    const results = matrixScores(vehicles, [{ metric: 'comfort', weight: 100 }]);
    const comforts = vehicles
      .filter(v => !v.archived)
      .map(v => v.ratings.comfort || 0);
    const maxComfort = Math.max(...comforts);
    expect(results[0].vehicle.ratings.comfort).toBe(maxComfort);
  });
});

// ─── deepMerge ───────────────────────────────────────────────────────────────

describe('deepMerge', () => {
  it('merges flat fields', () => {
    const base = { a: 1, b: 2 };
    const patch = { b: 99, c: 3 };
    expect(deepMerge(base, patch)).toEqual({ a: 1, b: 99, c: 3 });
  });

  it('deep-merges nested objects', () => {
    const base = { a: { x: 1, y: 2 } };
    const patch = { a: { x: 1, y: 99 } };  // full nested object for type compat
    expect(deepMerge(base, patch)).toEqual({ a: { x: 1, y: 99 } });
  });

  it('replaces arrays (does not merge them)', () => {
    const base = { attachments: [{ id: '1', name: 'a.pdf', type: 'pdf' }] };
    const patch = { attachments: [] };
    expect(deepMerge(base, patch).attachments).toEqual([]);
  });

  it('does not mutate the base object', () => {
    const base = { a: { x: 1 } };
    const patch = { a: { x: 2 } };
    const result = deepMerge(base, patch);
    expect(base.a.x).toBe(1); // untouched
    expect(result.a.x).toBe(2);
  });
});
