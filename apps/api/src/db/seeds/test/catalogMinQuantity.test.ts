import { describe, expect, it } from 'vitest';
import { SEED_CATALOG, seedMinQuantity } from '../catalog';

describe('seed catalog minimum quantity', () => {
  it('uses the smallest tier, an explicit value, or 1', () => {
    const tiers = [
      { quantity: 40, price: 1 },
      { quantity: 30, price: 1 },
    ];
    expect(seedMinQuantity({ tiers })).toBe(30);
    expect(seedMinQuantity({ tiers, minQuantity: 10 })).toBe(10);
    expect(seedMinQuantity({ tiers: [] })).toBe(1);
  });

  it('gives every seeded product a minimum it can be quoted at', () => {
    for (const product of SEED_CATALOG) {
      const min = seedMinQuantity(product);
      expect(min, product.name).toBeGreaterThanOrEqual(1);
      if (product.tiers.length > 0) {
        expect(
          product.tiers.some((t) => t.quantity >= min),
          product.name,
        ).toBe(true);
      }
    }
  });
});
