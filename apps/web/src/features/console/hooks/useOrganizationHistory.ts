import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpc/client';

export function useOrganizationHistory(organizationId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.console.history.list.queryOptions({ organizationId, limit: 50 }));
}
