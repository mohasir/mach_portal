import { useConfig } from '@/features/settings';

export function useCatalogSortable() {
  const { data } = useConfig();
  return data?.appSettings.catalogSortable ?? true;
}
