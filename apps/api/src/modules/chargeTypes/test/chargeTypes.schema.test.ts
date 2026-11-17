import { describe, expect, it } from 'vitest';
import {
  chargeTypesListQuerySchema,
  createChargeTypeSchema,
  isValidChargeValue,
  quoteChargesInputSchema,
} from '@repo/schemas';

describe('charge type schemas', () => {
  it('trims and requires the name', () => {
    expect(
      createChargeTypeSchema.parse({ name: '  Flete ', kind: 'fixed', defaultValue: 500 }),
    ).toEqual({ name: 'Flete', kind: 'fixed', defaultValue: 500 });
    const blank = createChargeTypeSchema.safeParse({ name: ' ', kind: 'fixed', defaultValue: 0 });
    expect(blank.error?.issues[0]?.message).toBe('chargeTypes.validation.nameRequired');
  });

  it('takes a percent value as a rate above 0 up to 1, rounded to 5 decimals', () => {
    const parse = (defaultValue: number) =>
      createChargeTypeSchema.safeParse({ name: 'Tarjeta', kind: 'percent', defaultValue });
    expect(parse(0.033333).data?.defaultValue).toBe(0.03333);
    expect(parse(1).success).toBe(true);
    expect(parse(0).success).toBe(false);
    expect(parse(0.000001).success).toBe(false);
    expect(parse(1.5).error?.issues[0]?.message).toBe('chargeTypes.validation.valueInvalid');
  });

  it('takes a fixed value as whole non-negative cents', () => {
    expect(isValidChargeValue('fixed', 0)).toBe(true);
    expect(isValidChargeValue('fixed', 2500)).toBe(true);
    expect(isValidChargeValue('fixed', -1)).toBe(false);
    expect(isValidChargeValue('fixed', 10.5)).toBe(false);
    expect(isValidChargeValue('fixed', Number.NaN)).toBe(false);
  });

  it('lists in catalog order by default', () => {
    expect(chargeTypesListQuerySchema.parse({})).toMatchObject({
      sortBy: 'sortOrder',
      sortDir: 'asc',
    });
    expect(chargeTypesListQuerySchema.safeParse({ sortBy: 'tenantId' }).success).toBe(false);
  });

  it('refuses the same charge type twice and negative values on a quote', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(quoteChargesInputSchema.parse(undefined)).toEqual([]);
    expect(
      quoteChargesInputSchema.safeParse([{ chargeTypeId: id }, { chargeTypeId: id }]).success,
    ).toBe(false);
    expect(quoteChargesInputSchema.safeParse([{ chargeTypeId: id, value: -1 }]).success).toBe(
      false,
    );
  });
});
