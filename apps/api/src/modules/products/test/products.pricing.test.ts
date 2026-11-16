import { describe, expect, it } from 'vitest';
import { isQuotable } from '../products.pricing';

const tier = { quantity: 30, price: 1000 };
const fixed = (price: number | null, minQuantity = 1) => ({ price, minQuantity });

describe('isQuotable', () => {
  it('is quotable with a price, tiers or not, add-on or not', () => {
    expect(isQuotable(fixed(5), [], false)).toBe(true);
    expect(isQuotable(fixed(5), [tier], true)).toBe(true);
    expect(isQuotable(fixed(0), [], false)).toBe(true);
  });

  it('is quotable through tiers only when the add-on is active', () => {
    expect(isQuotable(fixed(null), [tier], true)).toBe(true);
    expect(isQuotable(fixed(null), [tier], false)).toBe(false);
  });

  it('is not quotable without price and tiers', () => {
    expect(isQuotable(fixed(null), [], true)).toBe(false);
    expect(isQuotable(fixed(null), [], false)).toBe(false);
  });

  it('counts only the tiers that reach the minimum quantity', () => {
    expect(isQuotable(fixed(null, 30), [tier], true)).toBe(true);
    expect(isQuotable(fixed(null, 31), [tier], true)).toBe(false);
    expect(isQuotable(fixed(5, 31), [tier], true)).toBe(true);
  });
});
