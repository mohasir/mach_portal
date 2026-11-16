import { describe, expect, it } from 'vitest';
import { createProductSchema, priceTierSchema } from '@repo/schemas';

const INT4_MAX = 2_147_483_647;
const UOM_ID = '00000000-0000-4000-8000-000000000001';
const product = (price: number) => ({
  name: 'Menu',
  isPremium: false,
  tiers: [],
  price,
  uomId: UOM_ID,
});

describe('product unit', () => {
  it('requires a unit id', () => {
    const { uomId: _omitted, ...withoutUnit } = product(100);
    const result = createProductSchema.safeParse(withoutUnit);
    expect(result.error?.issues[0]?.message).toBe('catalog.validation.unitRequired');
    expect(createProductSchema.safeParse({ ...withoutUnit, uomId: 'nope' }).success).toBe(false);
  });
});

describe('price upper bound (Postgres integer column)', () => {
  it('accepts the largest integer and rejects the next one for a product price', () => {
    expect(createProductSchema.safeParse(product(INT4_MAX)).success).toBe(true);
    expect(createProductSchema.safeParse(product(INT4_MAX + 1)).success).toBe(false);
  });

  it('accepts the largest integer and rejects the next one for a tier price', () => {
    expect(priceTierSchema.safeParse({ quantity: 10, price: INT4_MAX }).success).toBe(true);
    expect(priceTierSchema.safeParse({ quantity: 10, price: INT4_MAX + 1 }).success).toBe(false);
  });
});
