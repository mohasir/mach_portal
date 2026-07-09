import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/admin/access';
import { ROLES, type RoleType } from '../constants/index';
import { permissionsMatrix } from '../mappings/permissions.matrix';
import { rolesPermissionsMatrix, type RolePermissions } from '../mappings/rolesPermissions.matrix';

const domainStatements = Object.fromEntries(
  permissionsMatrix.map(({ resource, actions }) => [resource, [...actions]]),
) as {
  [Item in (typeof permissionsMatrix)[number] as Item['resource']]: Item['actions'][number][];
};

export const statements = {
  ...defaultStatements,
  ...domainStatements,
};

export const ac = createAccessControl(statements);

const permissionsByRole = Object.fromEntries(
  rolesPermissionsMatrix.map(({ role, permissions }) => [role, permissions]),
) as Record<RoleType, RolePermissions>;

export const roles = {
  [ROLES.SUPERADMIN]: ac.newRole(statements),
  [ROLES.ADMIN]: ac.newRole({
    ...permissionsByRole[ROLES.ADMIN],
  }),
  [ROLES.MEMBER]: ac.newRole({
    ...permissionsByRole[ROLES.MEMBER],
  }),
} as const;

export type Role = RoleType;

export const SUPERADMIN_ROLE: Role = ROLES.SUPERADMIN;
export const DEFAULT_ROLE: Role = ROLES.MEMBER;
export const ADMIN_ROLES: Role[] = [ROLES.SUPERADMIN];

export type PermissionCheck = {
  [Resource in keyof typeof statements]?: (typeof statements)[Resource][number][];
};

export function hasPermission(
  role: string | null | undefined,
  permissions: PermissionCheck,
): boolean {
  const userRoles = (role ?? DEFAULT_ROLE).split(',') as Role[];
  // Superadmin: bypass total, no valida nada.
  if (userRoles.includes(SUPERADMIN_ROLE)) return true;
  return userRoles.some((r) => roles[r]?.authorize(permissions).success ?? false);
}
