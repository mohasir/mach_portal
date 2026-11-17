import { TRPCError } from '@trpc/server';
import { coverageAllows, getCountry, isValidPlace, regionName } from '@repo/geo';
import { AppError, ErrorCodes, type ErrorCode } from '../../lib/errors';
import {
  activeLocation,
  type ActiveLocationSettings,
  type LocationSettingsResource,
} from '../locationSettings/locationSettings.resource';

export type QuotePlace = {
  country: string | null;
  region: string | null;
  locality: string | null;
  address: string | null;
};

type PlaceInput = { region?: string; locality?: string; address?: string };

const EMPTY_PLACE: QuotePlace = { country: null, region: null, locality: null, address: null };

// The stored value may be a whole quote row: only its place may reach the write.
const placeOf = ({ country, region, locality, address }: QuotePlace): QuotePlace => ({
  country,
  region,
  locality,
  address,
});

const rejected = (code: ErrorCode) =>
  new TRPCError({ code: 'BAD_REQUEST', cause: new AppError(code) });

// With the function off nothing is required; on, every configured level, in the configured
// country, and the address when the organization asks for it.
export function isLocationComplete(place: QuotePlace, settings: LocationSettingsResource): boolean {
  const active = activeLocation(settings);
  if (!active) return true;
  return (
    // A quote saved while the function was off has no country yet; the next save stamps it.
    (place.country === null || place.country === active.country) &&
    (active.depth < 1 || !!place.region) &&
    (active.depth < 2 || !!place.locality) &&
    (!active.askAddress || !!place.address)
  );
}

async function assertPlaceAllowed(
  settings: ActiveLocationSettings,
  region: string | null,
  locality: string | null,
) {
  if (region === null) {
    if (locality !== null) throw rejected(ErrorCodes.quote.INVALID_LOCATION);
    return;
  }
  if (!(await isValidPlace(settings.country, region, locality ?? undefined))) {
    throw rejected(ErrorCodes.quote.INVALID_LOCATION);
  }
  if (settings.scope !== 'areas') return;
  // A draft may hold the region alone: it is covered when any area lies in it.
  const covered =
    locality === null
      ? settings.areas.some((a) => a.region === region)
      : coverageAllows({ scope: 'areas', areas: settings.areas }, region, locality);
  if (!covered) throw rejected(ErrorCodes.quote.LOCATION_NOT_COVERED);
}

// The place a create or update stores. The country always comes from the settings, levels past the
// configured depth are dropped, and with the function off (or the address not asked) the stored
// values are kept whatever the input holds. A place resent exactly as stored is kept without being
// checked again, so data saved before (migrated cities included) survives editing other fields.
export async function resolveQuotePlace(
  settings: LocationSettingsResource,
  input: PlaceInput,
  stored: QuotePlace | null,
  isDraft: boolean,
): Promise<QuotePlace> {
  const active = activeLocation(settings);
  if (!active) return stored ? placeOf(stored) : EMPTY_PLACE;

  const region = active.depth >= 1 ? (input.region ?? null) : null;
  const locality = active.depth >= 2 ? (input.locality ?? null) : null;
  const address = active.askAddress ? (input.address ?? null) : (stored?.address ?? null);
  const unchanged =
    stored !== null &&
    stored.country === active.country &&
    stored.region === region &&
    stored.locality === locality;
  if (!unchanged) await assertPlaceAllowed(active, region, locality);

  const place = { country: active.country, region, locality, address };
  if (!isDraft && !isLocationComplete(place, settings)) {
    throw rejected(ErrorCodes.quote.LOCATION_INCOMPLETE);
  }
  return place;
}

// Street address, then locality, then the region's name from the dataset (its code when unknown).
export function formatQuotePlace(place: QuotePlace): string | undefined {
  const country = place.country ? getCountry(place.country) : undefined;
  const region =
    place.region && country
      ? (regionName(country.code, place.region) ?? place.region)
      : place.region;
  return [place.address, place.locality, region].filter(Boolean).join(', ') || undefined;
}
