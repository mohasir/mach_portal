import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpc/client';

export function useOrganizationSummary(organizationId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.console.summary.organization.queryOptions({ organizationId }));
}
