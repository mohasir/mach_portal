import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpc/client';

export function useOrganization(organizationId: string) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.console.organizations.get.queryOptions({ organizationId }),
    // A missing organization will not appear on a retry.
    retry: false,
  });
}
