'use client';
import { DEFAULT_ROLE, hasPermission, type PermissionCheck } from '@repo/guards';
import { useSession } from '@/lib/auth/client';

/**
 * Devuelve `can(permissions)` que evalúa permisos contra el rol de la sesión
 * usando el catálogo compartido de `@repo/guards` (evaluación local, sin ir al server).
 * Ej: `const can = useCan(); can({ note: ['create'] })`.
 */
export function useCan() {
  const { data } = useSession();
  const role = (data?.user as { role?: string | null } | undefined)?.role ?? DEFAULT_ROLE;
  return (permissions: PermissionCheck) => hasPermission(role, permissions);
}
