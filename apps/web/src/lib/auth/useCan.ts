'use client';
import { DEFAULT_ROLE, hasPermission, type PermissionCheck } from '@repo/guards';
import { useSession } from '@/lib/auth/client';

export function useCan() {
  const { data } = useSession();
  const role = (data?.user as { role?: string | null } | undefined)?.role ?? DEFAULT_ROLE;
  return (permissions: PermissionCheck) => hasPermission(role, permissions);
}
