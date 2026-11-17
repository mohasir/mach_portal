import { getCountry, regionName, type CountryCode } from '@repo/geo';
import type { LocationArea, UpdateLocationSettingsInput } from '@repo/schemas';
import type { LocationSettings } from '@/components/shared/LocationFields/helpers';

export type LocationSettingsForm = LocationSettings;

export type MissingLocationField = 'country' | 'depth' | 'scope' | 'areas' | 'areasBeyondDepth';

export const toLocationForm = (saved: LocationSettings): LocationSettingsForm => ({
  ...saved,
  areas: [...saved.areas],
});

const compareAreas = (a: LocationArea, b: LocationArea) =>
  a.region.localeCompare(b.region) || (a.locality ?? '').localeCompare(b.locality ?? '');

const sameArea = (a: LocationArea, b: LocationArea) =>
  a.region === b.region && a.locality === b.locality;

/** Same rules as the API: a whole-region area absorbs the localities of that region. */
export function addArea(areas: LocationArea[], area: LocationArea): LocationArea[] {
  const wholeRegion = areas.some((a) => a.region === area.region && a.locality === null);
  if (wholeRegion) return areas;
  const rest = area.locality === null ? areas.filter((a) => a.region !== area.region) : areas;
  if (rest.some((a) => sameArea(a, area))) return rest;
  return [...rest, area].sort(compareAreas);
}

export const removeArea = (areas: LocationArea[], area: LocationArea): LocationArea[] =>
  areas.filter((a) => !sameArea(a, area));

export function areaLabel(country: CountryCode, area: LocationArea): string {
  const region = regionName(country, area.region) ?? area.region;
  return area.locality ? `${area.locality}, ${region}` : region;
}

/** The areas belong to a country's regions, so another country starts without them. */
export const withCountry = (
  form: LocationSettingsForm,
  country: CountryCode,
): LocationSettingsForm => ({
  ...form,
  country,
  areas: form.country === country ? form.areas : [],
});

/** Mirrors the API checks that decide whether the function can be turned on. */
export function missingSettings(form: LocationSettingsForm): MissingLocationField[] {
  const missing: MissingLocationField[] = [];
  if (!form.country || !getCountry(form.country)) missing.push('country');
  if (form.depth === null) missing.push('depth');
  if (form.scope === null) missing.push('scope');
  if (form.scope === 'areas') {
    if (form.areas.length === 0) missing.push('areas');
    else if (
      form.depth !== null &&
      (form.depth === 0 || (form.depth < 2 && form.areas.some((a) => a.locality !== null)))
    ) {
      missing.push('areasBeyondDepth');
    }
  }
  return missing;
}

/**
 * Turning on sends the draft (null while incomplete, so nothing is applied); turning off
 * resends the saved configuration, since the draft may hold unsaved edits.
 */
export function settingsPayload(
  form: LocationSettingsForm,
  saved: LocationSettings,
): UpdateLocationSettingsInput | null {
  if (!form.enabled) return toInput(saved, false);
  if (missingSettings(form).length > 0) return null;
  return toInput(form, true);
}

const toInput = (source: LocationSettings, enabled: boolean): UpdateLocationSettingsInput => ({
  enabled,
  country: source.country,
  depth: source.depth,
  scope: source.scope,
  areas: source.scope === 'areas' ? source.areas : [],
  askAddress: source.askAddress,
});

const normalized = (form: LocationSettingsForm) => ({
  ...form,
  areas: [...form.areas].sort(compareAreas),
});

export const isLocationFormDirty = (form: LocationSettingsForm, saved: LocationSettings): boolean =>
  JSON.stringify(normalized(form)) !== JSON.stringify(normalized(saved));
