#!/usr/bin/env node
//
// BC Vehicle Purchase Tax Calculator (standalone CLI)
//
// Usage:
//   node scripts/bc-tax-calc.mjs --selling 46249 --type zev --sale dealer \
//     --delivery 1950 --ppsa 58 --enviro 100 --trade 10000
//
// All amounts in CAD. Flags:
//   --selling   Selling price (required)
//   --type      gas | zev (default: gas)
//   --sale      dealer | private (default: dealer)
//   --delivery  Delivery & destination fee (default: 0)
//   --ppsa      PPSA / lien registration fee (default: 0)
//   --enviro    Environmental fee (GST-only, not PST) (default: 0)
//   --trade     Trade-in value (default: 0, applies to dealer sales only)

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
}

const sellingPrice = Number(flag('selling', '0'));
const vehicleType = flag('type', 'gas');        // gas | zev
const saleType = flag('sale', 'dealer');         // dealer | private
const delivery = Number(flag('delivery', '0'));
const ppsa = Number(flag('ppsa', '0'));
const enviro = Number(flag('enviro', '0'));
const tradeIn = Number(flag('trade', '0'));

if (!sellingPrice) {
  console.error('Usage: node scripts/bc-tax-calc.mjs --selling <price> [--type gas|zev] [--sale dealer|private] [--delivery N] [--ppsa N] [--enviro N] [--trade N]');
  process.exit(1);
}

const isDealer = saleType === 'dealer';
const isZEV = vehicleType === 'zev';

// ── PST brackets ──────────────────────────────────────────────────────────────

// Non-ZEV dealer (passenger vehicle)
const PST_DEALER = [
  { min: 0, rate: 0.07 },
  { min: 55_000, rate: 0.08 },
  { min: 56_000, rate: 0.09 },
  { min: 57_000, rate: 0.10 },
  { min: 125_000, rate: 0.15 },
  { min: 150_000, rate: 0.20 },
];

// ZEV dealer (new passenger vehicle) — 7% band extends to $75k
const PST_DEALER_ZEV = [
  { min: 0, rate: 0.07 },
  { min: 75_000, rate: 0.08 },
  { min: 76_000, rate: 0.09 },
  { min: 77_000, rate: 0.10 },
  { min: 125_000, rate: 0.15 },
  { min: 150_000, rate: 0.20 },
];

// Private sale: flat 12% for both ZEV and non-ZEV.
// The used-ZEV PST exemption (Feb 23 2022 – Apr 30 2025) has expired.
const PST_PRIVATE = [{ min: 0, rate: 0.12 }];

function lookupRate(tiers, base) {
  let rate = tiers[0].rate;
  for (const t of tiers) if (base >= t.min) rate = t.rate;
  return rate;
}

function chooseTiers() {
  if (isDealer) return isZEV ? PST_DEALER_ZEV : PST_DEALER;
  return PST_PRIVATE;
}

// ── Tax calculation ───────────────────────────────────────────────────────────

const tradeReduction = isDealer ? tradeIn : 0;

// GST base: selling price + all GST-applicable fees − trade-in (dealer only)
// GST applies to: delivery, PPSA, AND environmental
const gstBase = Math.max(0, sellingPrice + delivery + ppsa + enviro - tradeReduction);
const gstAmount = isDealer ? gstBase * 0.05 : 0;

// PST bracket: selling price after trade-in ONLY (fees don't affect the bracket)
const pstBracketBase = Math.max(0, sellingPrice - tradeReduction);
const pstRate = lookupRate(chooseTiers(), pstBracketBase);

// PST tax base: selling price + delivery + PPSA − trade-in (NOT environmental)
const pstTaxBase = Math.max(0, sellingPrice + delivery + ppsa - tradeReduction);
const pstAmount = pstTaxBase * pstRate;

// Federal luxury tax (selling price > $100k)
const luxuryTax = sellingPrice > 100_000
  ? Math.min(0.10 * sellingPrice, 0.20 * (sellingPrice - 100_000))
  : 0;

const totalTax = gstAmount + pstAmount + luxuryTax;
const totalFees = delivery + ppsa + enviro;
const outTheDoor = sellingPrice + totalTax + totalFees;

// ── Per-fee tax attribution ───────────────────────────────────────────────────

const feeLines = [];
if (delivery > 0) {
  const fg = isDealer ? delivery * 0.05 : 0;
  const fp = delivery * pstRate;
  feeLines.push({ label: 'Delivery & destination', amount: delivery, gst: fg, pst: fp, total: fg + fp });
}
if (ppsa > 0) {
  const fg = isDealer ? ppsa * 0.05 : 0;
  const fp = ppsa * pstRate;
  feeLines.push({ label: 'PPSA fee', amount: ppsa, gst: fg, pst: fp, total: fg + fp });
}
if (enviro > 0) {
  const fg = isDealer ? enviro * 0.05 : 0;
  feeLines.push({ label: 'Environmental fee', amount: enviro, gst: fg, pst: 0, total: fg, note: 'GST only' });
}

// ── Output ────────────────────────────────────────────────────────────────────

const $ = n => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
const pct = n => `${(n * 100).toFixed(1)}%`;

console.log('');
console.log('═══ BC Vehicle Purchase Tax Calculator ═══');
console.log('');
console.log(`  Vehicle type:   ${isZEV ? 'ZEV (zero-emission)' : 'Gas / ICE'}`);
console.log(`  Sale type:      ${isDealer ? 'Dealer (GST registrant)' : 'Private sale'}`);
console.log('');
console.log('── Price ──────────────────────────────────');
console.log(`  Selling price:           ${$(sellingPrice).padStart(12)}`);
if (tradeIn > 0) {
  console.log(`  Trade-in value:         ${('−' + $(tradeIn)).padStart(12)}`);
  if (!isDealer) console.log('    (trade-in ignored — private sale)');
}
console.log('');
console.log('── Fees ───────────────────────────────────');
if (delivery > 0) console.log(`  Delivery & destination:  ${$(delivery).padStart(12)}  (GST + PST)`);
if (ppsa > 0)     console.log(`  PPSA fee:                ${$(ppsa).padStart(12)}  (GST + PST)`);
if (enviro > 0)   console.log(`  Environmental fee:       ${$(enviro).padStart(12)}  (GST only)`);
if (totalFees === 0) console.log('  (none)');
console.log('');
console.log('── Tax ────────────────────────────────────');
console.log(`  PST bracket base:        ${$(pstBracketBase).padStart(12)}  (selling price − trade)`);
console.log(`  PST rate:                ${pct(pstRate).padStart(12)}`);
console.log(`  PST tax base:            ${$(pstTaxBase).padStart(12)}  (+ delivery, PPSA)`);
if (isDealer) {
  console.log(`  GST (5%):                ${$(gstAmount).padStart(12)}  on ${$(gstBase)}`);
}
console.log(`  PST (${pct(pstRate)}):             ${$(pstAmount).padStart(12)}  on ${$(pstTaxBase)}`);
if (luxuryTax > 0) console.log(`  Luxury tax:              ${$(luxuryTax).padStart(12)}`);
console.log(`  Total tax:               ${$(totalTax).padStart(12)}`);
console.log('');

if (feeLines.length > 0) {
  console.log('── Fee tax attribution ────────────────────');
  for (const f of feeLines) {
    console.log(`  ${f.label.padEnd(26)} ${$(f.amount).padStart(10)}  → tax: ${$(f.total).padStart(10)}${f.note ? '  (' + f.note + ')' : ''}`);
    if (f.gst > 0) console.log(`${''.padStart(40)}GST: ${$(f.gst).padStart(10)}`);
    if (f.pst > 0) console.log(`${''.padStart(40)}PST: ${$(f.pst).padStart(10)}`);
  }
  console.log('');
}

console.log('══════════════════════════════════════════');
console.log(`  OUT-THE-DOOR TOTAL:      ${$(outTheDoor).padStart(12)}`);
console.log('══════════════════════════════════════════');
console.log('');
