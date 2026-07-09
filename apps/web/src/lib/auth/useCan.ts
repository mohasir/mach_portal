'use client';
import { DEFAULT_ROLE, hasPermission, type PermissionCheck } from '@repo/auth';
import { useSession } from '@/lib/auth/client';

/**
 * Devuelve `can(permissions)` que evalúa permisos contra el rol de la sesión
 * usando el catálogo compartido de `@repo/auth` (evaluación local, sin ir al server).
 * Ej: `const can = useCan(); can({ note: ['create'] })`.
 */
export function useCan() {
  const { data } = useSession();
  const role = (data?.user as { role?: string | null } | undefined)?.role ?? DEFAULT_ROLE;
  return (permissions: PermissionCheck) => hasPermission(role, permissions);
}
