import { describe, expect, it } from 'vitest';
import { isQuotable } from '../products.pricing';

const tier = { quantity: 30, price: 1000 };

describe('isQuotable', () => {
  it('is quotable with a price, tiers or not, add-on or not', () => {
    expect(isQuotable({ price: 5 }, [], false)).toBe(true);
    expect(isQuotable({ price: 5 }, [tier], true)).toBe(true);
    expect(isQuotable({ price: 0 }, [], false)).toBe(true);
  });

  it('is quotable through tiers only when the add-on is active', () => {
    expect(isQuotable({ price: null }, [tier], true)).toBe(true);
    expect(isQuotable({ price: null }, [tier], false)).toBe(false);
  });

  it('is not quotable without price and tiers', () => {
    expect(isQuotable({ price: null }, [], true)).toBe(false);
    expect(isQuotable({ price: null }, [], false)).toBe(false);
  });
});
