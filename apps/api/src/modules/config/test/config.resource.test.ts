import { describe, expect, it } from 'vitest';
import { updateQuoteDefaultsSchema, updateTaxPreferencesSchema } from '@repo/schemas';
import { publicAppSettingsColumns } from '../config.resource';

// The minimum quantity per quote line belongs to each product (products.min_quantity).
describe('quote defaults without a global minimum per line', () => {
  it('no longer selects or returns the setting', () => {
    expect(Object.keys(publicAppSettingsColumns)).not.toContain('minPersonsPerLine');
  });

  it('drops the setting from the update input', () => {
    const parsed = updateQuoteDefaultsSchema.parse({
      depositRate: 0.3,
      quoteValidityMonths: 6,
      minPersonsPerLine: 10,
      quoteSeqStart: 77,
      currency: 'MXN',
      optionsSelectionDeadlineDays: 3,
    });
    expect(parsed).not.toHaveProperty('minPersonsPerLine');
  });
});

describe('tax settings', () => {
  it('select the default tax rate and no tax by state', () => {
    const keys = Object.keys(publicAppSettingsColumns);
    expect(keys).toContain('defaultTaxRate');
    expect(keys).not.toContain('applyTaxByState');
    expect(keys).not.toContain('promptRateChanges');
  });

  it('validate the default tax rate as a rate', () => {
    const parse = (defaultTaxRate: number) =>
      updateTaxPreferencesSchema.safeParse({ defaultTaxRate }).success;
    expect(parse(0.08875)).toBe(true);
    expect(parse(0)).toBe(true);
    expect(parse(1.2)).toBe(false);
    expect(parse(-0.01)).toBe(false);
  });
});
