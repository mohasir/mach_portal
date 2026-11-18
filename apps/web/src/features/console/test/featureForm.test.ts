import { describe, expect, it } from 'vitest';
import {
  buildFeatureSetInput,
  isValidCurrency,
  lastActiveDay,
  toFeatureFormValues,
  type FeatureFormValues,
} from '../helpers';

const stored = {
  expiresAt: '2027-01-01T00:00:00.000Z',
  priceCents: 1999,
  billingPeriod: 'monthly',
  currency: 'USD',
};

const initial = toFeatureFormValues(stored);

describe('lastActiveDay', () => {
  it('is the day before the stored expiry instant', () => {
    expect(lastActiveDay('2027-01-01T00:00:00.000Z')).toBe('2026-12-31');
  });

  it('is null without an expiry', () => {
    expect(lastActiveDay(null)).toBeNull();
  });
});

describe('toFeatureFormValues', () => {
  it('shows the price in major units', () => {
    expect(initial).toEqual({
      expiresOn: '2026-12-31',
      price: 19.99,
      billingPeriod: 'monthly',
      currency: 'USD',
    });
  });

  it('is empty for a feature with nothing stored', () => {
    expect(
      toFeatureFormValues({
        expiresAt: null,
        priceCents: null,
        billingPeriod: null,
        currency: null,
      }),
    ).toEqual({ expiresOn: null, price: null, billingPeriod: null, currency: null });
  });
});

describe('buildFeatureSetInput', () => {
  it('sends nothing for an untouched form', () => {
    expect(buildFeatureSetInput(initial, initial)).toEqual({});
  });

  it('sends only the changed fields', () => {
    const next: FeatureFormValues = { ...initial, expiresOn: '2027-06-30' };
    expect(buildFeatureSetInput(initial, next)).toEqual({ expiresOn: '2027-06-30' });
  });

  it('converts the price to whole cents', () => {
    const next: FeatureFormValues = { ...initial, price: 20.1 };
    expect(buildFeatureSetInput(initial, next)).toEqual({ priceCents: 2010 });
  });

  it('sends null to clear a stored value', () => {
    const next: FeatureFormValues = {
      expiresOn: null,
      price: null,
      billingPeriod: null,
      currency: null,
    };
    expect(buildFeatureSetInput(initial, next)).toEqual({
      expiresOn: null,
      priceCents: null,
      billingPeriod: null,
      currency: null,
    });
  });

  it('trims and uppercases the currency', () => {
    const next: FeatureFormValues = { ...initial, currency: ' eur ' };
    expect(buildFeatureSetInput(initial, next)).toEqual({ currency: 'EUR' });
  });

  it('treats a blank currency as cleared', () => {
    const next: FeatureFormValues = { ...initial, currency: '  ' };
    expect(buildFeatureSetInput(initial, next)).toEqual({ currency: null });
  });
});

describe('isValidCurrency', () => {
  it('accepts exactly three letters, ignoring surrounding spaces', () => {
    expect(isValidCurrency('usd')).toBe(true);
    expect(isValidCurrency(' EUR ')).toBe(true);
  });

  it('rejects other lengths and non-letters', () => {
    expect(isValidCurrency('US')).toBe(false);
    expect(isValidCurrency('USDD')).toBe(false);
    expect(isValidCurrency('U5D')).toBe(false);
  });
});
