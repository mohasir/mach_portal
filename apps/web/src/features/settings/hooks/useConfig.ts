import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpc/client';

/** config.get — shared with the quote builder (docs/mach-bar-flows.md §5.1). */
export function useConfig() {
  const trpc = useTRPC();
  return useQuery(trpc.config.get.queryOptions());
}
