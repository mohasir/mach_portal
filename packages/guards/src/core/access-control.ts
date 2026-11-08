import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/admin/access';
import { ROLES, type RoleType } from '../constants/index';
import { permissionsMatrix } from '../mappings/permissions.matrix';

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

// Only for Better Auth's admin plugin, which requires a role set. Its endpoints are server-only and
// no service calls them; tenant authorization is resolved from each membership's role rows, so the
// global roles grant nothing except the legacy platform role.
export const roles = {
  [ROLES.SUPERADMIN]: ac.newRole(statements),
  [ROLES.ADMIN]: ac.newRole({}),
  [ROLES.OPERATOR]: ac.newRole({}),
  [ROLES.MEMBER]: ac.newRole({}),
} as const;

export type Role = RoleType;

export const DEFAULT_ROLE: Role = ROLES.MEMBER;
export const ADMIN_ROLES: Role[] = [ROLES.SUPERADMIN];

export type PermissionCheck = {
  [Resource in keyof typeof statements]?: (typeof statements)[Resource][number][];
};
