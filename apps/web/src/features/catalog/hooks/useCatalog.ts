import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpc/client';

/** Full tree (active + inactive) consumed by the catalog editor. */
export function useCatalog() {
  const trpc = useTRPC();
  return useQuery(trpc.products.catalog.queryOptions({ includeInactive: true }));
}
