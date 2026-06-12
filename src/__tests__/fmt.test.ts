import { describe, it, expect } from 'vitest';
import { money, moneyK, score, pct, vehicleName } from '../lib/fmt';

describe('money', () => {
  it('formats zero', () => {
    expect(money(0)).toBe('$0');
  });

  it('adds thousands separator', () => {
    expect(money(1234)).toBe('$1,234');
    expect(money(1000000)).toBe('$1,000,000');
  });

  it('defaults to no decimal places', () => {
    expect(money(99.9)).toBe('$100');
    expect(money(1234.4)).toBe('$1,234');
  });

  it('respects decimals parameter', () => {
    expect(money(1234.5, 2)).toBe('$1,234.50');
    expect(money(50, 2)).toBe('$50.00');
  });
});

describe('moneyK', () => {
  it('uses full money format below 1000', () => {
    expect(moneyK(0)).toBe('$0');
    expect(moneyK(999)).toBe('$999');
  });

  it('formats 1000 as 1k', () => {
    expect(moneyK(1000)).toBe('$1k');
  });

  it('formats large values in thousands', () => {
    expect(moneyK(25000)).toBe('$25k');
    expect(moneyK(100000)).toBe('$100k');
  });
});

describe('score', () => {
  it('defaults to 1 decimal place', () => {
    expect(score(72.456)).toBe('72.5');
    expect(score(0)).toBe('0.0');
    expect(score(100)).toBe('100.0');
  });

  it('respects decimals parameter', () => {
    expect(score(72.456, 0)).toBe('72');
    expect(score(72.456, 2)).toBe('72.46');
  });
});

describe('pct', () => {
  it('appends % with one decimal place', () => {
    expect(pct(4.567)).toBe('4.6%');
    expect(pct(0)).toBe('0.0%');
    expect(pct(100)).toBe('100.0%');
  });

  it('rounds to one decimal', () => {
    expect(pct(33.333)).toBe('33.3%');
  });
});

describe('vehicleName', () => {
  it('concatenates year, make, and model', () => {
    expect(vehicleName({ year: 2024, make: 'Toyota', model: 'RAV4' })).toBe('2024 Toyota RAV4');
  });

  it('handles special characters in model name', () => {
    expect(vehicleName({ year: 2020, make: 'Ford', model: 'F-150' })).toBe('2020 Ford F-150');
  });
});
