import { describe, expect, it } from 'vitest';
import { updateTaxPreferencesSchema } from '@repo/schemas';
import {
  toDefaultTaxFormValues,
  toDefaultTaxUpdateInput,
  toQuoteDefaultsFormValues,
  toQuoteDefaultsUpdateInput,
  visibleSettingsSections,
  withStoredValues,
} from '../helpers';
import type { Config } from '../types';

describe('withStoredValues', () => {
  it('fills fields whose controls were not rendered with the stored value', () => {
    const stored = { allowSelectOptionsAtQuote: true, hideStaleQuotes: false };
    expect(withStoredValues(stored, { hideStaleQuotes: true } as typeof stored)).toEqual({
      allowSelectOptionsAtQuote: true,
      hideStaleQuotes: true,
    });
  });

  it('lets submitted values win', () => {
    expect(withStoredValues({ a: 1, b: 2 }, { a: 5 } as { a: number; b: number })).toEqual({
      a: 5,
      b: 2,
    });
  });
});

describe('visibleSettingsSections', () => {
  const all = {
    quotesActive: true,
    canTaxRates: true,
    canQuoteDefaults: true,
    canQuoteStages: true,
    canLocationSettings: true,
    canCatalogPreferences: true,
    canQuotePdfTemplate: true,
  };

  it('shows every section when quotes is active and the user can see everything', () => {
    expect(visibleSettingsSections(all)).toEqual({
      general: true,
      preferences: true,
      quotePdfTemplate: true,
    });
  });

  it('hides the quote PDF template without quotes but keeps the tax rates in general', () => {
    expect(visibleSettingsSections({ ...all, quotesActive: false })).toEqual({
      general: true,
      preferences: true,
      quotePdfTemplate: false,
    });
  });

  it('hides general when only quote cards would remain and quotes is off', () => {
    expect(
      visibleSettingsSections({ ...all, quotesActive: false, canTaxRates: false }).general,
    ).toBe(false);
    expect(visibleSettingsSections({ ...all, canTaxRates: false }).general).toBe(true);
  });

  it('still depends on the permissions', () => {
    expect(
      visibleSettingsSections({
        ...all,
        canQuoteDefaults: false,
        canQuoteStages: false,
        canLocationSettings: false,
        canTaxRates: false,
      }).general,
    ).toBe(false);
    expect(
      visibleSettingsSections({
        ...all,
        canQuoteDefaults: false,
        canQuoteStages: false,
        canTaxRates: false,
      }).general,
    ).toBe(true);
    expect(visibleSettingsSections({ ...all, canCatalogPreferences: false }).preferences).toBe(
      false,
    );
  });
});

// The minimum quantity per quote line is a field of each product now.
describe('quote defaults', () => {
  const config = {
    appSettings: {
      depositRate: 0.5,
      quoteValidityMonths: 3,
      quoteSeqStart: 1,
      currency: 'USD',
      optionsSelectionDeadlineDays: 7,
    },
    lastUsedSeq: 4,
  } as unknown as Config;

  it('neither reads nor sends a global minimum per line', () => {
    const values = toQuoteDefaultsFormValues(config);
    expect(values).not.toHaveProperty('minPersonsPerLine');
    expect(values.quoteSeqStart).toBe(5);
    expect(toQuoteDefaultsUpdateInput(values)).not.toHaveProperty('minPersonsPerLine');
  });
});

describe('default tax rate', () => {
  const config = { appSettings: { defaultTaxRate: 0.08875 } } as unknown as Config;

  it('shows the stored rate as a percentage', () => {
    expect(toDefaultTaxFormValues(config)).toEqual({ defaultTaxRatePercent: 8.875 });
  });

  it('sends the rate back as a decimal without float noise', () => {
    expect(toDefaultTaxUpdateInput({ defaultTaxRatePercent: 8.875 })).toEqual({
      defaultTaxRate: 0.08875,
    });
    expect(toDefaultTaxUpdateInput({ defaultTaxRatePercent: 7 })).toEqual({ defaultTaxRate: 0.07 });
  });

  it('produces an input the API schema accepts', () => {
    const input = toDefaultTaxUpdateInput(toDefaultTaxFormValues(config));
    expect(updateTaxPreferencesSchema.safeParse(input).success).toBe(true);
  });
});
