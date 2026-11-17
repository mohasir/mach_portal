import { describe, expect, it } from 'vitest';
import {
  addArea,
  areaLabel,
  isLocationFormDirty,
  missingSettings,
  removeArea,
  settingsPayload,
  toLocationForm,
  withCountry,
  type LocationSettingsForm,
} from '../locationHelpers';

const off: LocationSettingsForm = {
  enabled: false,
  country: null,
  depth: null,
  scope: null,
  areas: [],
  askAddress: false,
};

const complete: LocationSettingsForm = {
  enabled: true,
  country: 'US',
  depth: 2,
  scope: 'country',
  areas: [],
  askAddress: true,
};

describe('missingSettings', () => {
  it('lists every missing field of an empty form', () => {
    expect(missingSettings({ ...off, enabled: true })).toEqual(['country', 'depth', 'scope']);
  });

  it('detects each missing field on its own', () => {
    expect(missingSettings({ ...complete, country: null })).toEqual(['country']);
    expect(missingSettings({ ...complete, depth: null })).toEqual(['depth']);
    expect(missingSettings({ ...complete, scope: null })).toEqual(['scope']);
  });

  it('asks for an area when the coverage is by areas', () => {
    expect(missingSettings({ ...complete, scope: 'areas' })).toEqual(['areas']);
    const areas = [{ region: 'NY', locality: null }];
    expect(missingSettings({ ...complete, scope: 'areas', areas })).toEqual([]);
  });

  it('rejects areas that the precision cannot match', () => {
    const wholeRegion = [{ region: 'NY', locality: null }];
    expect(missingSettings({ ...complete, depth: 0, scope: 'areas', areas: wholeRegion })).toEqual([
      'areasBeyondDepth',
    ]);
    const locality = [{ region: 'NY', locality: 'Albany' }];
    expect(missingSettings({ ...complete, depth: 1, scope: 'areas', areas: locality })).toEqual([
      'areasBeyondDepth',
    ]);
    expect(missingSettings({ ...complete, depth: 2, scope: 'areas', areas: locality })).toEqual([]);
  });

  it('ignores areas while the coverage is the whole country', () => {
    const areas = [{ region: 'NY', locality: 'Albany' }];
    expect(missingSettings({ ...complete, depth: 1, areas })).toEqual([]);
  });
});

describe('settingsPayload', () => {
  it('is built only from a complete form', () => {
    expect(settingsPayload({ ...complete, depth: null }, off)).toBeNull();
    expect(settingsPayload(complete, off)).toEqual({
      enabled: true,
      country: 'US',
      depth: 2,
      scope: 'country',
      areas: [],
      askAddress: true,
    });
  });

  it('sends the areas only for coverage by areas', () => {
    const areas = [{ region: 'NY', locality: null }];
    expect(settingsPayload({ ...complete, areas }, off)?.areas).toEqual([]);
    expect(settingsPayload({ ...complete, scope: 'areas', areas }, off)?.areas).toEqual(areas);
  });

  it('turns the function off keeping the saved configuration, not the edited draft', () => {
    const saved = {
      ...complete,
      scope: 'areas' as const,
      areas: [{ region: 'NY', locality: null }],
    };
    const draft = { ...saved, enabled: false, country: 'NI' as const, depth: 0 as const };
    expect(settingsPayload(draft, saved)).toEqual({
      enabled: false,
      country: 'US',
      depth: 2,
      scope: 'areas',
      areas: [{ region: 'NY', locality: null }],
      askAddress: true,
    });
  });

  it('turns off a function that was never configured', () => {
    expect(settingsPayload(off, off)).toEqual({
      enabled: false,
      country: null,
      depth: null,
      scope: null,
      areas: [],
      askAddress: false,
    });
  });
});

describe('areas', () => {
  it('adds a region and a locality', () => {
    const areas = addArea(addArea([], { region: 'NY', locality: null }), {
      region: 'NJ',
      locality: 'Newark',
    });
    expect(areas).toEqual([
      { region: 'NJ', locality: 'Newark' },
      { region: 'NY', locality: null },
    ]);
  });

  it('does not duplicate an area', () => {
    const once = addArea([], { region: 'NY', locality: 'Albany' });
    expect(addArea(once, { region: 'NY', locality: 'Albany' })).toEqual(once);
  });

  it('absorbs localities when the whole region is added', () => {
    const areas = addArea([{ region: 'NY', locality: 'Albany' }], { region: 'NY', locality: null });
    expect(areas).toEqual([{ region: 'NY', locality: null }]);
  });

  it('ignores a locality of a region that is already covered whole', () => {
    const areas = [{ region: 'NY', locality: null }];
    expect(addArea(areas, { region: 'NY', locality: 'Albany' })).toEqual(areas);
  });

  it('removes one area', () => {
    const areas = [
      { region: 'NJ', locality: null },
      { region: 'NY', locality: 'Albany' },
    ];
    expect(removeArea(areas, { region: 'NY', locality: 'Albany' })).toEqual([
      { region: 'NJ', locality: null },
    ]);
  });

  it('labels an area with the region name', () => {
    expect(areaLabel('US', { region: 'NY', locality: null })).toBe('New York');
    expect(areaLabel('US', { region: 'NY', locality: 'Albany' })).toBe('Albany, New York');
  });
});

describe('form state', () => {
  it('starts from the saved settings', () => {
    const saved = {
      ...complete,
      scope: 'areas' as const,
      areas: [{ region: 'NY', locality: null }],
    };
    expect(toLocationForm(saved)).toEqual(saved);
  });

  it('drops the areas when the country changes', () => {
    const form = {
      ...complete,
      scope: 'areas' as const,
      areas: [{ region: 'NY', locality: null }],
    };
    expect(withCountry(form, 'NI')).toMatchObject({ country: 'NI', areas: [] });
    expect(withCountry(form, 'US').areas).toHaveLength(1);
  });

  it('detects unsaved edits ignoring the order of the areas', () => {
    const a = { region: 'NJ', locality: null };
    const b = { region: 'NY', locality: null };
    const saved = { ...complete, scope: 'areas' as const, areas: [a, b] };
    expect(isLocationFormDirty(saved, saved)).toBe(false);
    expect(isLocationFormDirty({ ...saved, areas: [b, a] }, saved)).toBe(false);
    expect(isLocationFormDirty({ ...saved, askAddress: false }, saved)).toBe(true);
    expect(isLocationFormDirty({ ...saved, enabled: false }, saved)).toBe(true);
  });
});
