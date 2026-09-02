import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/admin/access';
import { ROLES, type ResourceType, type RoleType } from '../constants/index';
import { permissionsMatrix } from '../mappings/permissions.matrix';
import {
  rolesPermissionsMatrix,
  type ResourceScope,
  type RolePermissions,
} from '../mappings/rolesPermissions.matrix';

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

// better-auth's ac.newRole() only knows plain action arrays — a resource grant that
// carries a { actions, scope } wrapper gets unwrapped down to its `actions` here; the
// `scope` half is business logic of our own (see resolveResourceScope), not something
// better-auth's access-control plugin has any notion of.
function toRoleStatements(permissions: RolePermissions) {
  const result: Record<string, string[]> = {};
  for (const [resource, grant] of Object.entries(permissions)) {
    if (grant) result[resource] = Array.isArray(grant) ? grant : grant.actions;
  }
  return result as Parameters<typeof ac.newRole>[0];
}

export const roles = {
  [ROLES.SUPERADMIN]: ac.newRole(statements),
  [ROLES.ADMIN]: ac.newRole(toRoleStatements(permissionsByRole[ROLES.ADMIN])),
  [ROLES.OPERATOR]: ac.newRole(toRoleStatements(permissionsByRole[ROLES.OPERATOR])),
  [ROLES.MEMBER]: ac.newRole(toRoleStatements(permissionsByRole[ROLES.MEMBER])),
} as const;

export type Role = RoleType;

export const SUPERADMIN_ROLE: Role = ROLES.SUPERADMIN;
export const DEFAULT_ROLE: Role = ROLES.MEMBER;
export const ADMIN_ROLES: Role[] = [ROLES.SUPERADMIN];

// Per-resource row scoping (ej. listas/mutaciones de quotes/events filtradas por
// createdBy/assignedTo). A role can grant 'own' on QUOTE y 'all' en otro resource a la
// vez — ver ResourceGrant. Con múltiples roles (string separado por comas), 'all' gana
// si CUALQUIERA de los roles del usuario lo otorga para ese resource.
export function resolveResourceScope(
  role: string | null | undefined,
  resource: ResourceType,
): ResourceScope {
  const userRoles = (role ?? DEFAULT_ROLE).split(',') as Role[];
  let sawOwn = false;
  for (const r of userRoles) {
    const grant = permissionsByRole[r]?.[resource];
    if (!grant) continue;
    if (Array.isArray(grant) || grant.scope === 'all') return 'all';
    sawOwn = true;
  }
  return sawOwn ? 'own' : 'all';
}

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
