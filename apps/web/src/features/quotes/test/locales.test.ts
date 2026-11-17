import { describe, expect, it } from 'vitest';
import esApi from '@/locales/es/api.json';
import enApi from '@/locales/en/api.json';
import esQuotes from '@/locales/es/quotes.json';
import enQuotes from '@/locales/en/quotes.json';
import esSettings from '@/locales/es/settings.json';
import enSettings from '@/locales/en/settings.json';

type Tree = { [key: string]: string | Tree };

const keys = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );

describe('quotes, settings and api locales', () => {
  it('have the same keys in es and en', () => {
    expect(keys(enQuotes).sort()).toEqual(keys(esQuotes).sort());
    expect(keys(enSettings).sort()).toEqual(keys(esSettings).sort());
    expect(keys(enApi).sort()).toEqual(keys(esApi).sort());
  });

  it('translate the extra charge errors and validations', () => {
    for (const api of [esApi, enApi]) {
      expect(keys(api)).toEqual(
        expect.arrayContaining([
          'errors.CHARGE_TYPE_NOT_FOUND',
          'errors.CHARGE_TYPE_NAME_TAKEN',
          'errors.CHARGE_TYPE_INVALID_VALUE',
          'errors.CHARGE_TYPE_INACTIVE',
        ]),
      );
    }
    for (const quotes of [esQuotes, enQuotes]) {
      expect(keys(quotes)).toEqual(
        expect.arrayContaining(['validation.chargeValueInvalid', 'validation.chargeDuplicated']),
      );
    }
  });
});
