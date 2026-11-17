import { describe, expect, it } from 'vitest';
import {
  COUNTRIES,
  coverageAllows,
  isValidPlace,
  levelLabel,
  loadLocalities,
  regionName,
  regionsOf,
  type Coverage,
  type CountryCode,
} from '../index';

const COUNTRY_CODES: CountryCode[] = ['US', 'NI'];
// Same comparator as scripts/generate-us.ts.
const SORT = (a: string, b: string) => a.localeCompare(b, 'en');

describe('regions', () => {
  it('US has 50 states plus DC with two-letter codes', () => {
    const regions = regionsOf('US');
    expect(regions).toHaveLength(51);
    for (const r of regions) {
      expect(r.code).toMatch(/^[A-Z]{2}$/);
      expect(r.name.trim()).not.toBe('');
    }
    expect(regions.map((r) => r.code)).toContain('DC');
    expect(regionName('US', 'TX')).toBe('Texas');
  });

  it('NI has 15 departamentos plus 2 autonomous regions', () => {
    const regions = regionsOf('NI');
    expect(regions).toHaveLength(17);
    expect(regionName('NI', 'RACCN')).toBeDefined();
    expect(regionName('NI', 'RACCS')).toBeDefined();
  });

  it('returned lists are copies: mutating them does not affect later calls', async () => {
    (regionsOf('US') as unknown[]).pop();
    expect(regionsOf('US')).toHaveLength(51);
    ((await loadLocalities('US', 'DC')) as string[]).pop();
    expect(await loadLocalities('US', 'DC')).toEqual(['Washington']);
  });

  it('region codes are unique and unknown ones have no name', () => {
    for (const c of COUNTRY_CODES) {
      const codes = regionsOf(c).map((r) => r.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
    expect(regionName('US', 'ZZ')).toBeUndefined();
  });
});

describe('localities integrity', () => {
  for (const country of COUNTRY_CODES) {
    it(`${country}: every region has clean, unique, sorted localities`, async () => {
      for (const { code } of regionsOf(country)) {
        const list = await loadLocalities(country, code);
        expect(list.length, `${country}-${code}`).toBeGreaterThan(0);
        expect(new Set(list).size, `${country}-${code} duplicates`).toBe(list.length);
        expect([...list], `${country}-${code} order`).toEqual([...list].sort(SORT));
        for (const name of list) {
          expect(name, `${country}-${code}`).toBe(name.trim());
          expect(name).not.toBe('');
        }
      }
    });
  }

  it('US excludes hamlet noise and keeps real cities', async () => {
    const tx = await loadLocalities('US', 'TX');
    expect(tx).toContain('Austin');
    expect(tx).not.toContain('107 West Colonia');
    const ny = await loadLocalities('US', 'NY');
    expect(ny).toContain('Albany');
  });

  it('NI has the official 153 municipalities with known per-region counts', async () => {
    const expected: Record<string, number> = {
      BO: 6,
      CA: 8,
      CI: 13,
      CO: 10,
      ES: 6,
      GR: 4,
      JI: 8,
      LE: 10,
      MD: 9,
      MN: 9,
      MS: 9,
      MT: 13,
      NS: 12,
      SJ: 6,
      RI: 10,
      RACCN: 8,
      RACCS: 12,
    };
    let total = 0;
    for (const { code } of regionsOf('NI')) {
      const list = await loadLocalities('NI', code);
      expect(list.length, code).toBe(expected[code]);
      total += list.length;
    }
    expect(total).toBe(153);
  });

  it('resolves to an empty list for an unknown region and never rejects', async () => {
    expect(await loadLocalities('US', 'ZZ')).toEqual([]);
    expect(await loadLocalities('US', '../../regions')).toEqual([]);
  });
});

describe('isValidPlace', () => {
  it('accepts a locality of its region', async () => {
    const [first] = await loadLocalities('US', 'TX');
    expect(await isValidPlace('US', 'TX', first)).toBe(true);
    expect(await isValidPlace('US', 'TX')).toBe(true);
    expect(await isValidPlace('NI', 'RACCN')).toBe(true);
  });

  it('rejects a locality of another region, a missing one and an unknown region', async () => {
    const [first] = await loadLocalities('NI', 'RACCN');
    expect(await isValidPlace('NI', 'MN', first)).toBe(false);
    expect(await isValidPlace('US', 'TX', 'Nowhereville-xyz')).toBe(false);
    expect(await isValidPlace('US', 'ZZ')).toBe(false);
    expect(await isValidPlace('US', undefined, 'Austin')).toBe(false);
  });

  it('accepts country-only', async () => {
    expect(await isValidPlace('US')).toBe(true);
  });
});

describe('coverageAllows', () => {
  const country: Coverage = { scope: 'country' };
  const areas: Coverage = {
    scope: 'areas',
    areas: [
      { region: 'NY', locality: null },
      { region: 'TX', locality: 'Austin' },
    ],
  };

  it('country covers everything', () => {
    expect(coverageAllows(country, 'TX', 'Austin')).toBe(true);
    expect(coverageAllows(country)).toBe(true);
  });

  it('a whole region covers any locality in it', () => {
    expect(coverageAllows(areas, 'NY')).toBe(true);
    expect(coverageAllows(areas, 'NY', 'Albany')).toBe(true);
  });

  it('a concrete locality covers only that locality', () => {
    expect(coverageAllows(areas, 'TX', 'Austin')).toBe(true);
    expect(coverageAllows(areas, 'TX', 'Dallas')).toBe(false);
  });

  it('a region alone does not satisfy a locality-specific area', () => {
    expect(coverageAllows(areas, 'TX')).toBe(false);
  });

  it('empty areas cover nothing', () => {
    const none: Coverage = { scope: 'areas', areas: [] };
    expect(coverageAllows(none, 'NY')).toBe(false);
    expect(coverageAllows(none)).toBe(false);
  });

  it('rejects places outside the areas', () => {
    expect(coverageAllows(areas, 'CA')).toBe(false);
    expect(coverageAllows(areas, 'CA', 'Fresno')).toBe(false);
    expect(coverageAllows(areas, undefined, 'Austin')).toBe(false);
  });
});

describe('levelLabel', () => {
  it('returns es and en names per level', () => {
    expect(levelLabel('US', 1, 'es')).toBe('estado');
    expect(levelLabel('US', 1, 'en')).toBe('state');
    expect(levelLabel('US', 2, 'es')).toBe('ciudad');
    expect(levelLabel('NI', 1, 'es')).toBe('departamento');
    expect(levelLabel('NI', 2, 'en')).toBe('municipality');
    expect(COUNTRIES.NI.levels).toHaveLength(2);
  });
});
