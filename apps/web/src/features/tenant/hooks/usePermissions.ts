'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC, useTRPCClient } from '@/lib/trpc/client';
import {
  organizationScopedKey,
  permissionsPollInterval,
  refreshPermissionsIfStale,
  toPermissionsState,
} from '../permissions';
import { useActiveOrganizationId } from './useTenant';

/**
 * The caller's permissions in the active organization: the only source the web authorizes from.
 * Kept fresh by the response version header, the version poll and window focus, so mounting
 * another consumer does not refetch.
 */
export function usePermissions() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const organizationId = useActiveOrganizationId();

  const query = useQuery({
    queryKey: organizationScopedKey(trpc.tenant.permissions.queryKey(), organizationId),
    queryFn: () => client.tenant.permissions.query(),
    enabled: !!organizationId,
    staleTime: 0,
    refetchOnMount: false,
  });

  return {
    ...toPermissionsState(query.data),
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/**
 * Polls the permissions version and refreshes the permissions when it moved. Mounted once (by the
 * tenant gate): every mounted copy would run its own interval.
 */
export function usePermissionsSync() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const organizationId = useActiveOrganizationId();

  useQuery({
    queryKey: organizationScopedKey(trpc.tenant.permissionsVersion.queryKey(), organizationId),
    queryFn: async () => {
      const result = await client.tenant.permissionsVersion.query();
      refreshPermissionsIfStale(qc, trpc.tenant.permissions.queryFilter(), result.version);
      return result;
    },
    enabled: !!organizationId,
    staleTime: 0,
    refetchInterval: (query) => permissionsPollInterval(query.state.error),
    // The permissions query itself refetches on focus; polling here too would double the request.
    refetchOnWindowFocus: false,
  });
}
