import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpc/client';

export function useCatalog() {
  const trpc = useTRPC();
  return useQuery(trpc.products.catalog.queryOptions({ includeInactive: true }));
}

/** Active-only tree consumed by the quote builder (mach-bar-flows.md §2.1). */
export function useProductCatalog() {
  const trpc = useTRPC();
  return useQuery(trpc.products.list.queryOptions());
}

export function useProduct(id: string) {
  const { data, ...rest } = useCatalog();
  return { data: data?.find((p) => p.id === id), ...rest };
}
