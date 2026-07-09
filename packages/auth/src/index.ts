import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access';

/**
 * Catálogo de permisos: recurso → acciones.
 * Fuente de verdad ÚNICA compartida entre backend (admin plugin + guardedProcedure)
 * y frontend (adminClient + useCan/<Can>). Ver docs/frontend/architecture.md §8.
 *
 * Para agregar un recurso nuevo, añadí su entrada acá y otórgalo en los roles de abajo.
 */
export const statements = {
  // Recursos de gestión de usuarios/sesiones que provee el plugin `admin`.
  ...defaultStatements,
  // Recursos de dominio de la app.
  note: ['create', 'read', 'update', 'delete'],
} as const;

export const ac = createAccessControl(statements);

/**
 * Roles = subconjuntos de acciones permitidas. Editá acá para ajustar el RBAC.
 * - `superadmin`: acceso total. Saltea toda validación de permisos (ver `hasPermission`).
 * - `admin`: gestión de usuarios (del plugin) + CRUD completo de notas.
 * - `member`: CRUD de sus propias notas (la pertenencia se aplica en el repositorio).
 */
export const roles = {
  // Concede todas las acciones de todos los recursos del catálogo (crece solo).
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

/** Rol con bypass total: pasa cualquier chequeo de permisos, incluso recursos fuera del catálogo. */
export const SUPERADMIN_ROLE: Role = 'superadmin';

/** Rol asignado a los nuevos usuarios al registrarse. */
export const DEFAULT_ROLE: Role = 'member';

/** Roles con acceso a los endpoints de administración del plugin `admin`. */
export const ADMIN_ROLES: Role[] = ['superadmin', 'admin'];

/** Forma de una consulta de permisos: `{ note: ['create'], ... }`. */
export type PermissionCheck = Parameters<(typeof roles)['admin']['authorize']>[0];

/** Evalúa permisos contra uno o más roles (soporta roles CSV). Isomórfico BE↔FE. */
export function hasPermission(role: string | null | undefined, permissions: PermissionCheck): boolean {
  const userRoles = (role ?? DEFAULT_ROLE).split(',') as Role[];
  // Superadmin: bypass total, no valida nada.
  if (userRoles.includes(SUPERADMIN_ROLE)) return true;
  return userRoles.some((r) => roles[r]?.authorize(permissions).success ?? false);
}
