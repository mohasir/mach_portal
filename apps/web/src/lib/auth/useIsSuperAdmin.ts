'use client';
import { ROLES } from '@repo/guards';
import { useSession } from '@/lib/auth/client';

export function useIsSuperAdmin() {
  const { data } = useSession();
  const role = (data?.user as { role?: string | null } | undefined)?.role ?? '';
  return role.split(',').includes(ROLES.SUPERADMIN);
}
