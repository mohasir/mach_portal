import type { CountryCode } from '@repo/geo';
import type { LocationArea, LocationDepth, LocationScope } from '@repo/schemas';
import { tenantLocation, tenantLocationAreas } from '../../db/schema';

export const publicLocationColumns = {
  enabled: tenantLocation.enabled,
  country: tenantLocation.country,
  depth: tenantLocation.depth,
  scope: tenantLocation.scope,
  askAddress: tenantLocation.askAddress,
} as const;

export const publicLocationAreaColumns = {
  region: tenantLocationAreas.region,
  locality: tenantLocationAreas.locality,
} as const;

export type PublicTenantLocation = Pick<
  typeof tenantLocation.$inferSelect,
  keyof typeof publicLocationColumns
>;

// A missing row reads as the function turned off with an empty form.
export const locationSettingsResource = (
  row: PublicTenantLocation | undefined,
  areas: LocationArea[],
) => ({
  enabled: row?.enabled ?? false,
  // Only written after checking it against @repo/geo.
  country: (row?.country ?? null) as CountryCode | null,
  depth: row?.depth ?? null,
  scope: row?.scope ?? null,
  areas:
    row?.scope === 'areas' ? areas.map((a) => ({ region: a.region, locality: a.locality })) : [],
  askAddress: row?.askAddress ?? false,
});

export type LocationSettingsResource = ReturnType<typeof locationSettingsResource>;

export type ActiveLocationSettings = LocationSettingsResource & {
  enabled: true;
  country: CountryCode;
  depth: LocationDepth;
  scope: LocationScope;
};

// The database check guarantees an enabled row is complete; the narrowing makes it visible to TS.
export const activeLocation = (
  settings: LocationSettingsResource,
): ActiveLocationSettings | null =>
  settings.enabled && settings.country && settings.depth !== null && settings.scope
    ? (settings as ActiveLocationSettings)
    : null;
