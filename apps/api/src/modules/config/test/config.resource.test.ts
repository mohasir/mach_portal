import { describe, expect, it } from 'vitest';
import { updateQuoteDefaultsSchema } from '@repo/schemas';
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
