import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ConsoleOrganizationListQuery } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';

export function useOrganizations(query: ConsoleOrganizationListQuery) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.console.organizations.list.queryOptions(query),
    placeholderData: keepPreviousData,
  });
}
