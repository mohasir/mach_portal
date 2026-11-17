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

describe('product SKU, cost, minimum quantity and category', () => {
  it('trims the SKU and turns a blank one into null', () => {
    expect(createProductSchema.parse({ ...product(1), sku: '  AB-1 ' }).sku).toBe('AB-1');
    expect(createProductSchema.parse({ ...product(1), sku: '   ' }).sku).toBeNull();
    expect(createProductSchema.parse(product(1)).sku).toBeUndefined();
    expect(createProductSchema.safeParse({ ...product(1), sku: 'x'.repeat(65) }).success).toBe(
      false,
    );
  });

  it('accepts a cost of zero or more cents, or null', () => {
    expect(createProductSchema.safeParse({ ...product(1), cost: 0 }).success).toBe(true);
    expect(createProductSchema.safeParse({ ...product(1), cost: null }).success).toBe(true);
    const negative = createProductSchema.safeParse({ ...product(1), cost: -1 });
    expect(negative.error?.issues[0]?.message).toBe('catalog.validation.costInvalid');
    expect(createProductSchema.safeParse({ ...product(1), cost: 1.5 }).success).toBe(false);
  });

  it('requires a minimum quantity of at least 1 when given', () => {
    expect(createProductSchema.parse(product(1)).minQuantity).toBeUndefined();
    expect(createProductSchema.safeParse({ ...product(1), minQuantity: 1 }).success).toBe(true);
    const zero = createProductSchema.safeParse({ ...product(1), minQuantity: 0 });
    expect(zero.error?.issues[0]?.message).toBe('catalog.validation.minQuantityInvalid');
  });

  it('takes a category id or null', () => {
    expect(createProductSchema.safeParse({ ...product(1), categoryId: UOM_ID }).success).toBe(true);
    expect(createProductSchema.safeParse({ ...product(1), categoryId: null }).success).toBe(true);
    expect(createProductSchema.safeParse({ ...product(1), categoryId: 'x' }).success).toBe(false);
  });
});

describe('product descriptions', () => {
  it('trims both, turns blanks into null and enforces 500 and 10000 characters', () => {
    const parsed = createProductSchema.parse({
      ...product(1),
      shortDescription: '  hola ',
      longDescription: '   ',
    });
    expect(parsed.shortDescription).toBe('hola');
    expect(parsed.longDescription).toBeUndefined();
    const ok = (extra: object) =>
      createProductSchema.safeParse({ ...product(1), ...extra }).success;
    expect(ok({ shortDescription: 'x'.repeat(500) })).toBe(true);
    expect(ok({ shortDescription: 'x'.repeat(501) })).toBe(false);
    expect(ok({ longDescription: 'x'.repeat(10000) })).toBe(true);
    expect(ok({ longDescription: 'x'.repeat(10001) })).toBe(false);
  });
});
