import { DEFAULT_ROLE } from '@repo/guards';
import { useSession } from '@/lib/auth/client';
import { ADMIN_MENU } from '../config';
import type { NavGroup } from '../types';

export function useNavigation() {
  const { data, isPending } = useSession();

  if (isPending || !data) {
    return { menu: [] as NavGroup[], role: null, isLoading: true };
  }

  const role = (data.user as { role?: string | null }).role ?? DEFAULT_ROLE;

  return { menu: ADMIN_MENU, role, isLoading: false };
}
