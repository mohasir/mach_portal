import { TRPCError } from '@trpc/server';
import { getCountry, isValidPlace, type CountryCode } from '@repo/geo';
import type { LocationArea, UpdateLocationSettingsInput } from '@repo/schemas';
import { AppError, ErrorCodes, type ErrorCode } from '../../lib/errors';
import {
  LocationSettingsRepository,
  type LocationSettingsWrite,
} from './locationSettings.repository';
import { locationSettingsResource } from './locationSettings.resource';

const rejected = (code: ErrorCode) =>
  new TRPCError({ code: 'BAD_REQUEST', cause: new AppError(code) });

const codes = ErrorCodes.locationSettings;

// Sorted, without repeats, and without locality areas of a region that is already covered whole.
function normalizedAreas(areas: readonly LocationArea[]): LocationArea[] {
  const wholeRegions = new Set(areas.filter((a) => a.locality === null).map((a) => a.region));
  const unique = new Map<string, LocationArea>();
  for (const area of areas) {
    if (area.locality !== null && wholeRegions.has(area.region)) continue;
    unique.set(`${area.region}\u0000${area.locality ?? ''}`, area);
  }
  return [...unique.values()].sort(
    (a, b) =>
      a.region.localeCompare(b.region) || (a.locality ?? '').localeCompare(b.locality ?? ''),
  );
}

// Every field that is given must be valid for the others; enabling also needs the whole form.
async function validated(input: UpdateLocationSettingsInput): Promise<LocationSettingsWrite> {
  const country = input.country === null ? null : getCountry(input.country);
  if (input.country !== null && !country) throw rejected(codes.INVALID_COUNTRY);
  if (input.enabled && (!country || input.depth === null || input.scope === null)) {
    throw rejected(codes.INCOMPLETE);
  }
  if (country && input.depth !== null && input.depth > country.levels.length) {
    throw rejected(codes.INVALID_DEPTH);
  }

  const areas = input.scope === 'areas' ? normalizedAreas(input.areas) : [];
  if (input.scope === 'areas') {
    if (areas.length === 0) throw rejected(codes.AREAS_REQUIRED);
    if (!country) throw rejected(codes.INVALID_AREA);
    for (const area of areas) {
      const known = await isValidPlace(country.code, area.region, area.locality ?? undefined);
      if (!known) throw rejected(codes.INVALID_AREA);
    }
    // A quote never holds a level past the depth, so an area there could never be matched.
    if (input.depth !== null && areas.some((a) => input.depth! < (a.locality === null ? 1 : 2))) {
      throw rejected(codes.AREA_BEYOND_DEPTH);
    }
  }

  return {
    enabled: input.enabled,
    country: (country?.code ?? null) satisfies CountryCode | null,
    depth: input.depth,
    scope: input.scope,
    areas,
    askAddress: input.askAddress,
  };
}

export class LocationSettingsService {
  constructor(private repo: LocationSettingsRepository) {}

  async get() {
    const { row, areas } = await this.repo.find();
    return locationSettingsResource(row, areas);
  }

  async update(input: UpdateLocationSettingsInput) {
    await this.repo.save(await validated(input));
    return this.get();
  }
}
