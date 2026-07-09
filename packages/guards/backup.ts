import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access';

export const statements = {
  ...defaultStatements,
  note: ['create', 'read', 'update', 'delete'],
} as const;

export const ac = createAccessControl(statements);

export const roles = {
  superadmin: ac.newRole(statements),
  admin: ac.newRole({
    ...adminAc.statements,
    note: ['create', 'read', 'update', 'delete'],
  }),
  member: ac.newRole({
    note: ['read', 'update', 'delete'],
  }),
};

export type Role = keyof typeof roles;


export const SUPERADMIN_ROLE: Role = 'superadmin';


export const DEFAULT_ROLE: Role = 'member';


export const ADMIN_ROLES: Role[] = ['superadmin', 'admin'];

export type PermissionCheck = Parameters<(typeof roles)['admin']['authorize']>[0];

/** Evalúa permisos contra uno o más roles (soporta roles CSV). Isomórfico BE↔FE. */
export function hasPermission(role: string | null | undefined, permissions: PermissionCheck): boolean {
  const userRoles = (role ?? DEFAULT_ROLE).split(',') as Role[];
  // Superadmin: bypass total, no valida nada.
  if (userRoles.includes(SUPERADMIN_ROLE)) return true;
  return userRoles.some((r) => roles[r]?.authorize(permissions).success ?? false);
}
