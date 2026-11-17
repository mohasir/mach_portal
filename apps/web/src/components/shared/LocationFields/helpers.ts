import { getCountry, levelLabel, regionName, regionsOf, type CountryCode } from '@repo/geo';
import type { LocationArea, LocationDepth, LocationScope } from '@repo/schemas';

export type LocationLang = 'es' | 'en';

export interface LocationSettings {
  enabled: boolean;
  country: CountryCode | null;
  depth: LocationDepth | null;
  scope: LocationScope | null;
  areas: LocationArea[];
  askAddress: boolean;
}

export interface PlaceValue {
  region: string | null;
  locality: string | null;
}

export interface PlaceOption {
  value: string;
  label: string;
}

export interface LocationOptions {
  regions: PlaceOption[];
  localities: PlaceOption[];
}

/** The function counts as on only with a complete configuration. */
export function isLocationActive(
  settings: LocationSettings | null | undefined,
): settings is LocationSettings & { country: CountryCode; depth: LocationDepth } {
  return !!settings && settings.enabled && !!settings.country && settings.depth !== null;
}

/** The stored place was saved under another country than the one configured now. */
export const isPlaceStale = (
  settings: LocationSettings | null | undefined,
  storedCountry: string | null | undefined,
): boolean =>
  isLocationActive(settings) &&
  settings.depth > 0 &&
  !!storedCountry &&
  storedCountry !== settings.country;

const regionCovered = (settings: LocationSettings, region: string) =>
  settings.scope !== 'areas' || settings.areas.some((a) => a.region === region);

const localityCovered = (settings: LocationSettings, region: string, locality: string) =>
  settings.scope !== 'areas' ||
  settings.areas.some(
    (a) => a.region === region && (a.locality === null || a.locality === locality),
  );

/**
 * A stored region or locality that is not among the options (migrated free text, or a
 * coverage narrowed later) is kept as an option so the select shows it and resends it as is.
 */
export function locationOptions(
  settings: LocationSettings | null | undefined,
  value: PlaceValue,
  localities: readonly string[],
): LocationOptions {
  if (!isLocationActive(settings)) return { regions: [], localities: [] };
  const { country } = settings;

  const regions = regionsOf(country)
    .filter((r) => regionCovered(settings, r.code))
    .map((r) => ({ value: r.code, label: r.name }));
  if (value.region && !regions.some((r) => r.value === value.region)) {
    regions.push({ value: value.region, label: regionName(country, value.region) ?? value.region });
  }

  if (!value.region) return { regions, localities: [] };
  const region = value.region;
  const covered = localities
    .filter((name) => localityCovered(settings, region, name))
    .map((name) => ({ value: name, label: name }));
  if (value.locality && !covered.some((l) => l.value === value.locality)) {
    covered.unshift({ value: value.locality, label: value.locality });
  }
  return { regions, localities: covered };
}

const filled = (text: string | null | undefined) => !!text && text.trim().length > 0;

/** Mirrors the API rule: every level up to the depth, plus the address when it is asked. */
export function isLocationComplete(
  settings: LocationSettings,
  place: PlaceValue & { address?: string | null },
): boolean {
  if (!isLocationActive(settings)) return true;
  if (settings.depth >= 1 && !filled(place.region)) return false;
  if (settings.depth >= 2 && !filled(place.locality)) return false;
  if (settings.askAddress && !filled(place.address)) return false;
  return true;
}

export function levelTitle(country: CountryCode, level: 1 | 2, lang: LocationLang): string {
  const name = levelLabel(country, level, lang);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** "Locality, Region name"; a country or region outside the datasets shows the raw value. */
export function formatPlace(
  country: string | null | undefined,
  region: string | null | undefined,
  locality: string | null | undefined,
): string {
  const known = country ? getCountry(country) : undefined;
  const regionLabel = region ? ((known && regionName(known.code, region)) ?? region) : null;
  return [locality, regionLabel].filter(Boolean).join(', ');
}

export function regionOptions(country: string | null | undefined): PlaceOption[] {
  const known = country ? getCountry(country) : undefined;
  if (!known) return [];
  return regionsOf(known.code).map((r) => ({ value: r.code, label: r.name }));
}
