// Number formatters — all numbers in the UI use these

export function money(n: number, decimals = 0): string {
  return '$' + n.toLocaleString('en-CA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function moneyK(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(0) + 'k';
  return money(n);
}

export function score(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

export function pct(n: number): string {
  return n.toFixed(1) + '%';
}

export function vehicleName(v: { year: number; make: string; model: string }): string {
  return `${v.year} ${v.make} ${v.model}`;
}
