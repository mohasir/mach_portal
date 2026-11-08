import type { Organization } from './types';

export function canSwitchTenant({
  membershipCount,
  isPlatformAdmin,
}: {
  membershipCount: number;
  isPlatformAdmin: boolean;
}) {
  return isPlatformAdmin || membershipCount > 1;
}

/** A person with a single organization and none active goes straight in, without a choice screen. */
export function shouldAutoSelect({
  memberships,
  activeTenantId,
}: {
  memberships: Pick<Organization, 'id'>[];
  activeTenantId: string | null;
}): string | null {
  if (activeTenantId !== null || memberships.length !== 1) return null;
  return memberships[0]!.id;
}

export function filterOrganizations<T extends Pick<Organization, 'name' | 'slug'>>(
  items: T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter(
    (org) => org.name.toLowerCase().includes(needle) || org.slug.toLowerCase().includes(needle),
  );
}

export type GateState = 'loading' | 'redirect' | 'tenantError' | 'permissionsError' | 'ready';

/**
 * Loaded permissions win over a failed refetch: a background error must not blank a screen the
 * user is already working on.
 */
export function resolveGateState({
  tenantPending,
  tenantError,
  tenant,
  hasPermissions,
  permissionsError,
}: {
  tenantPending: boolean;
  tenantError: boolean;
  tenant: { id: string } | null | undefined;
  hasPermissions: boolean;
  permissionsError: boolean;
}): GateState {
  if (tenantError) return 'tenantError';
  if (tenantPending || tenant === undefined) return 'loading';
  if (tenant === null) return 'redirect';
  if (hasPermissions) return 'ready';
  return permissionsError ? 'permissionsError' : 'loading';
}
