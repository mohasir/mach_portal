import { describe, expect, it } from 'vitest';
import esApi from '@/locales/es/api.json';
import enApi from '@/locales/en/api.json';
import esQuotes from '@/locales/es/quotes.json';
import enQuotes from '@/locales/en/quotes.json';
import esCommon from '@/locales/es/common.json';
import enCommon from '@/locales/en/common.json';
import esClients from '@/locales/es/clients.json';
import enClients from '@/locales/en/clients.json';
import esRoles from '@/locales/es/roles.json';
import enRoles from '@/locales/en/roles.json';
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

  it('have the same keys in es and en for the location texts', () => {
    expect(keys(enCommon).sort()).toEqual(keys(esCommon).sort());
    expect(keys(enClients).sort()).toEqual(keys(esClients).sort());
    expect(keys(enRoles).sort()).toEqual(keys(esRoles).sort());
  });

  it('translate the operating location settings, errors and permission', () => {
    for (const api of [esApi, enApi]) {
      expect(keys(api)).toEqual(
        expect.arrayContaining([
          'errors.LOCATION_SETTINGS_INCOMPLETE',
          'errors.QUOTE_INVALID_LOCATION',
          'errors.QUOTE_LOCATION_NOT_COVERED',
          'errors.QUOTE_LOCATION_INCOMPLETE',
        ]),
      );
    }
    for (const settings of [esSettings, enSettings]) {
      expect(keys(settings)).toEqual(
        expect.arrayContaining([
          'location.title',
          'location.incomplete',
          'location.missing.country',
          'location.missing.areas',
          'location.depth.options.1',
        ]),
      );
    }
    for (const roles of [esRoles, enRoles]) {
      expect(keys(roles)).toContain('matrix.resources.location_settings.label');
    }
  });

  it('no longer carry the fixed state list', () => {
    for (const common of [esCommon, enCommon]) expect(keys(common)).not.toContain('states.NY');
  });
});
