import type { ResourceScope } from '../mappings/rolesPermissions.matrix';
import { isCatalogPermission } from './catalog';
import { supportsScope } from './scopedActions';
import type { PermissionCheck } from './access-control';

export type AccessGrants = {
  isOwner: boolean;
  grants: Record<string, ResourceScope>;
};

export function permissionKey(resource: string, action: string): string {
  return `${resource}.${action}`;
}

export function scopeFor(
  access: AccessGrants | null | undefined,
  resource: string,
  action: string,
): ResourceScope | null {
  if (!access) return null;
  if (access.isOwner) return 'all';
  // A permission retired from the catalog must never authorize, even if a stale row still grants it.
  if (!isCatalogPermission(resource, action)) return null;
  const scope = access.grants[permissionKey(resource, action)] ?? null;
  // 'own' only restricts the pairs the API filters by owner; elsewhere the grant is unrestricted, so
  // older rows stored as 'own' compare like 'all' (e.g. in the escalation checks).
  return scope && !supportsScope(resource, action) ? 'all' : scope;
}

export function can(access: AccessGrants | null | undefined, check: PermissionCheck): boolean {
  if (!access) return false;
  const pairs = Object.entries(check).flatMap(([resource, actions]) =>
    ((actions ?? []) as string[]).map((action) => [resource, action] as const),
  );
  // A check naming no action is malformed; granting it would open whatever it was meant to guard.
  if (pairs.length === 0) return false;
  if (access.isOwner) return true;
  return pairs.every(([resource, action]) => scopeFor(access, resource, action) !== null);
}
