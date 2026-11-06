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
