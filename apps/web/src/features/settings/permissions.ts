import { isCatalogPermission, type AccessGrants } from '@repo/guards';
import type { PermissionValue } from '@/features/roles';

/** What the read-only permission matrix shows for the viewer: their own grants, or all for an owner. */
export function toEffectivePermissions(access: AccessGrants | undefined): {
  value: PermissionValue;
  locked: boolean;
} {
  if (!access) return { value: {}, locked: false };
  if (access.isOwner) return { value: {}, locked: true };
  const value = Object.fromEntries(
    Object.entries(access.grants).filter(([key]) => {
      const dot = key.indexOf('.');
      return dot > 0 && isCatalogPermission(key.slice(0, dot), key.slice(dot + 1));
    }),
  );
  return { value, locked: false };
}
