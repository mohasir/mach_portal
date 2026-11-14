import { describe, expect, it } from 'vitest';
import { createProductSchema, priceTierSchema } from '@repo/schemas';

const INT4_MAX = 2_147_483_647;
const product = (price: number) => ({ name: 'Menu', isPremium: false, tiers: [], price });

describe('price upper bound (Postgres integer column)', () => {
  it('accepts the largest integer and rejects the next one for a product price', () => {
    expect(createProductSchema.safeParse(product(INT4_MAX)).success).toBe(true);
    expect(createProductSchema.safeParse(product(INT4_MAX + 1)).success).toBe(false);
  });

  it('accepts the largest integer and rejects the next one for a tier price', () => {
    expect(priceTierSchema.safeParse({ numPersons: 10, price: INT4_MAX }).success).toBe(true);
    expect(priceTierSchema.safeParse({ numPersons: 10, price: INT4_MAX + 1 }).success).toBe(false);
  });
});
