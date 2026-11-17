import { describe, expect, it } from 'vitest';
import {
  formatPlace,
  isLocationActive,
  isLocationComplete,
  isPlaceStale,
  levelTitle,
  locationOptions,
  regionOptions,
  type LocationSettings,
} from '../helpers';

const off: LocationSettings = {
  enabled: false,
  country: null,
  depth: null,
  scope: null,
  areas: [],
  askAddress: false,
};

const us = (patch: Partial<LocationSettings> = {}): LocationSettings => ({
  enabled: true,
  country: 'US',
  depth: 2,
  scope: 'country',
  areas: [],
  askAddress: true,
  ...patch,
});

const NO_PLACE = { region: null, locality: null };

describe('isLocationActive', () => {
  it('is false when off, missing or incomplete', () => {
    expect(isLocationActive(undefined)).toBe(false);
    expect(isLocationActive(off)).toBe(false);
    expect(isLocationActive({ ...us(), depth: null })).toBe(false);
  });

  it('is true for an enabled, complete configuration', () => {
    expect(isLocationActive(us())).toBe(true);
  });
});

describe('locationOptions', () => {
  it('offers every region of the country when coverage is the whole country', () => {
    const { regions } = locationOptions(us(), NO_PLACE, []);
    expect(regions).toHaveLength(51);
    expect(regions.find((r) => r.value === 'NY')).toEqual({ value: 'NY', label: 'New York' });
  });

  it('limits regions to the covered areas', () => {
    const settings = us({
      scope: 'areas',
      areas: [
        { region: 'NY', locality: null },
        { region: 'NJ', locality: 'Newark' },
      ],
    });
    expect(locationOptions(settings, NO_PLACE, []).regions.map((r) => r.value)).toEqual([
      'NJ',
      'NY',
    ]);
  });

  it('offers every locality of a wholly covered region', () => {
    const settings = us({ scope: 'areas', areas: [{ region: 'NY', locality: null }] });
    const { localities } = locationOptions(settings, { region: 'NY', locality: null }, [
      'Albany',
      'Buffalo',
    ]);
    expect(localities.map((l) => l.value)).toEqual(['Albany', 'Buffalo']);
  });

  it('limits localities to the covered ones when only some are covered', () => {
    const settings = us({
      scope: 'areas',
      areas: [
        { region: 'NY', locality: 'Albany' },
        { region: 'NJ', locality: null },
      ],
    });
    const { localities } = locationOptions(settings, { region: 'NY', locality: null }, [
      'Albany',
      'Buffalo',
    ]);
    expect(localities.map((l) => l.value)).toEqual(['Albany']);
  });

  it('offers no localities until a region is chosen', () => {
    expect(locationOptions(us(), NO_PLACE, ['Albany']).localities).toEqual([]);
  });

  it('keeps a stored locality that is not in the dataset', () => {
    const { localities } = locationOptions(us(), { region: 'NY', locality: 'Bronx' }, ['Albany']);
    expect(localities.map((l) => l.value)).toEqual(['Bronx', 'Albany']);
  });

  it('keeps a stored region outside the coverage', () => {
    const settings = us({ scope: 'areas', areas: [{ region: 'NY', locality: null }] });
    const { regions } = locationOptions(settings, { region: 'TX', locality: null }, []);
    expect(regions.map((r) => r.value)).toEqual(['NY', 'TX']);
  });

  it('uses the Nicaragua regions', () => {
    const settings = us({ country: 'NI' });
    const { regions } = locationOptions(settings, NO_PLACE, []);
    expect(regions).toHaveLength(17);
    expect(regions.some((r) => r.value === 'RACCN')).toBe(true);
  });

  it('is empty when the function is not active', () => {
    expect(locationOptions(off, NO_PLACE, [])).toEqual({ regions: [], localities: [] });
  });
});

describe('isLocationComplete', () => {
  const full = { region: 'NY', locality: 'Albany', address: '1 Main St' };

  it('needs nothing when the function is off', () => {
    expect(isLocationComplete(off, { ...NO_PLACE, address: '' })).toBe(true);
  });

  it('depth 0 needs only the address when it is asked', () => {
    expect(isLocationComplete(us({ depth: 0, askAddress: false }), { ...NO_PLACE })).toBe(true);
    expect(isLocationComplete(us({ depth: 0 }), { ...NO_PLACE, address: '  ' })).toBe(false);
    expect(isLocationComplete(us({ depth: 0 }), { ...NO_PLACE, address: 'x' })).toBe(true);
  });

  it('depth 1 needs the region', () => {
    const settings = us({ depth: 1, askAddress: false });
    expect(isLocationComplete(settings, NO_PLACE)).toBe(false);
    expect(isLocationComplete(settings, { region: 'NY', locality: null })).toBe(true);
  });

  it('depth 2 needs region and locality', () => {
    const settings = us({ askAddress: false });
    expect(isLocationComplete(settings, { region: 'NY', locality: null })).toBe(false);
    expect(isLocationComplete(settings, { region: null, locality: 'Albany' })).toBe(false);
    expect(isLocationComplete(settings, { region: 'NY', locality: 'Albany' })).toBe(true);
  });

  it('needs the address only when it is asked', () => {
    expect(isLocationComplete(us(), { ...full, address: '' })).toBe(false);
    expect(isLocationComplete(us(), full)).toBe(true);
    expect(isLocationComplete(us({ askAddress: false }), { ...full, address: '' })).toBe(true);
  });
});

describe('isPlaceStale', () => {
  it('flags a stored place of another country than the settings', () => {
    expect(isPlaceStale(us({ country: 'NI' }), 'US')).toBe(true);
    expect(isPlaceStale(us(), 'US')).toBe(false);
    expect(isPlaceStale(us(), null)).toBe(false);
    expect(isPlaceStale(off, 'US')).toBe(false);
  });

  it('is never stale at depth 0, where no place is asked', () => {
    expect(isPlaceStale(us({ country: 'NI', depth: 0 }), 'US')).toBe(false);
  });
});

describe('level and place names', () => {
  it('names the levels of the country in the language', () => {
    expect(levelTitle('US', 1, 'es')).toBe('Estado');
    expect(levelTitle('NI', 2, 'es')).toBe('Municipio');
    expect(levelTitle('NI', 1, 'en')).toBe('Department');
  });

  it('formats a stored place with the region name', () => {
    expect(formatPlace('US', 'NY', 'Albany')).toBe('Albany, New York');
    expect(formatPlace('US', 'NY', null)).toBe('New York');
    expect(formatPlace('US', null, null)).toBe('');
  });

  it('names a region with the country it was saved under, even when the code is shared', () => {
    expect(formatPlace('US', 'CA', null)).toBe('California');
    expect(formatPlace('NI', 'CA', null)).toBe('Carazo');
  });

  it('falls back to the raw values for an unknown country or region', () => {
    expect(formatPlace(null, 'NY', 'Bronx')).toBe('Bronx, NY');
    expect(formatPlace('US', 'ZZ', 'Bronx')).toBe('Bronx, ZZ');
    expect(formatPlace('XX', 'NY', null)).toBe('NY');
  });

  it('lists the regions of a country for filters', () => {
    expect(regionOptions('US')).toHaveLength(51);
    expect(regionOptions(null)).toEqual([]);
    expect(regionOptions('XX')).toEqual([]);
  });
});
