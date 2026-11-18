import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpc/client';

export function useConsoleFeatures(organizationId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.console.features.list.queryOptions({ organizationId }));
}
