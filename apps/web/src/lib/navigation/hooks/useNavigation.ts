import { usePermissions } from '@/features/tenant';
import { ADMIN_MENU } from '../config';
import type { NavGroup } from '../types';

// SidebarNav filters this menu with `can`, which denies everything until the permissions load;
// waiting for them shows the loading skeleton instead of an empty menu.
export function useNavigation() {
  const { isPending } = usePermissions();
  if (isPending) return { menu: [] as NavGroup[], isLoading: true };
  return { menu: ADMIN_MENU, isLoading: false };
}
