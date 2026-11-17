import { COUNTRIES, getCountry, type CountryCode } from './countries';
import usRegions from './data/us/regions.json';
import niRegions from './data/ni/regions.json';

export interface Region {
  code: string;
  name: string;
}

export type Coverage =
  { scope: 'country' } | { scope: 'areas'; areas: { region: string; locality: string | null }[] };

// NI codes follow ISO 3166-2 except the autonomous regions, which use the
// conventional RACCN/RACCS instead of ISO NI-AN/NI-AS. Codes are stored as text, so keep them stable.
const REGIONS: Record<CountryCode, Region[]> = {
  US: usRegions,
  NI: niRegions,
};

// One literal path per country: bundlers (webpack, Vite) resolve a template
// import with a fixed directory prefix into a per-file lazy chunk. The chunk names are stable so
// the web service worker can keep them out of its precache (see next.config.ts).
const LOADERS: Record<CountryCode, (region: string) => Promise<{ default: string[] }>> = {
  US: (region) =>
    import(
      /* webpackChunkName: "geo-us-localities-[request]" */ `./data/us/localities/${region}.json`
    ),
  NI: (region) =>
    import(
      /* webpackChunkName: "geo-ni-localities-[request]" */ `./data/ni/localities/${region}.json`
    ),
};

export function regionsOf(country: CountryCode): readonly Readonly<Region>[] {
  return [...REGIONS[country]];
}

export function regionName(country: CountryCode, code: string): string | undefined {
  return REGIONS[country].find((r) => r.code === code)?.name;
}

// Resolves to an empty array for an unknown country or region (it never rejects), so
// callers must not read an empty result as "this region has no localities".
export async function loadLocalities(
  country: CountryCode,
  region: string,
): Promise<readonly string[]> {
  // The region code is interpolated into an import path, so it must be a known code.
  if (!getCountry(country) || regionName(country, region) === undefined) return [];
  const mod = await LOADERS[country](region);
  return [...mod.default];
}

export async function isValidPlace(
  country: CountryCode,
  region?: string,
  locality?: string,
): Promise<boolean> {
  if (!getCountry(country)) return false;
  if (region === undefined) return locality === undefined;
  if (regionName(country, region) === undefined) return false;
  if (locality === undefined) return true;
  return (await loadLocalities(country, region)).includes(locality);
}

export function coverageAllows(coverage: Coverage, region?: string, locality?: string): boolean {
  if (coverage.scope === 'country') return true;
  if (region === undefined) return false;
  return coverage.areas.some(
    (a) => a.region === region && (a.locality === null || a.locality === locality),
  );
}

export function levelLabel(country: CountryCode, level: 1 | 2, lang: 'es' | 'en'): string {
  return COUNTRIES[country].levels[level === 1 ? 0 : 1][lang];
}
