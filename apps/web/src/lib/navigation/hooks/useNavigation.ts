import { useFeatures } from '@/features/tenant/hooks/useFeatures';
import { usePermissions } from '@/features/tenant';
import { ADMIN_MENU } from '../config';
import { filterMenuByFeatures } from '../filterMenu';
import type { NavGroup } from '../types';

// SidebarNav filters this menu with `can`, which denies everything until the permissions load;
// waiting for them shows the loading skeleton instead of an empty menu.
export function useNavigation() {
  const { isPending } = usePermissions();
  const { keys, isPending: featuresPending } = useFeatures();
  if (isPending || featuresPending) return { menu: [] as NavGroup[], isLoading: true };
  return { menu: filterMenuByFeatures(ADMIN_MENU, (key) => keys.has(key)), isLoading: false };
}
