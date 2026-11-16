'use client';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_CATALOG_KIND, type CatalogKind } from '@repo/schemas';
import { useTRPC, useTRPCClient } from '@/lib/trpc/client';
import { organizationScopedKey } from '../permissions';
import { useActiveOrganizationId } from './useTenant';

const PROFILE_STALE_MS = 30_000;

/** Platform-defined settings of the active organization; the default catalog kind until it loads. */
export function useTenantProfile(): { catalogKind: CatalogKind; isPending: boolean } {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const organizationId = useActiveOrganizationId();

  const query = useQuery({
    queryKey: organizationScopedKey(trpc.tenant.profile.queryKey(), organizationId),
    queryFn: () => client.tenant.profile.query(),
    enabled: !!organizationId,
    staleTime: PROFILE_STALE_MS,
    refetchOnWindowFocus: true,
  });

  return {
    catalogKind: query.data?.catalogKind ?? DEFAULT_CATALOG_KIND,
    isPending: query.isPending,
  };
}
