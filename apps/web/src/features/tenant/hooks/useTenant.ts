import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth/client';
import { useApiError } from '@/lib/error/useApiError';
import { useTRPC } from '@/lib/trpc/client';
import { canSwitchTenant } from '../helpers';
import { broadcastSessionChange } from '../sync';

export function useMemberships() {
  const trpc = useTRPC();
  return useQuery(trpc.tenant.memberships.queryOptions());
}

export function useAllOrganizations(enabled: boolean) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.tenant.listAll.queryOptions(), enabled });
}

// Always revalidated: the cookie cache behind `useSession` can lag the active organization,
// so the session must never be the source for it.
export function useActiveTenant() {
  const trpc = useTRPC();
  const { data: session } = useSession();
  return useQuery({ ...trpc.tenant.active.queryOptions(), staleTime: 0, enabled: !!session });
}

// Shares the `tenant.active` cache without refetching on every mount: it is read by every
// permission check, and the gate's own observer already keeps it revalidated.
// Mounted app-wide (e.g. via the API error handler), so it must not run without a session: the
// query throws UNAUTHORIZED.
export function useActiveOrganizationId() {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const { data } = useQuery({
    ...trpc.tenant.active.queryOptions(),
    staleTime: 0,
    refetchOnMount: false,
    enabled: !!session,
    select: (tenant) => tenant?.id,
  });
  return data;
}

// Read-only view of the `tenant.active` cache for callers that only need to know whether an
// organization is active. The gate's own observer keeps it revalidated, so this one neither
// refetches on mount nor runs before `enabled` (the query throws UNAUTHORIZED without a session).
export function useActiveTenantStatus(enabled: boolean) {
  const trpc = useTRPC();
  const { isSuccess, data } = useQuery({
    ...trpc.tenant.active.queryOptions(),
    staleTime: 0,
    refetchOnMount: false,
    enabled,
  });
  return { resolved: isSuccess, hasTenant: !!data };
}

export function useIsPlatformAdmin() {
  const { data } = useSession();
  return (data?.user as { isPlatformAdmin?: boolean | null } | undefined)?.isPlatformAdmin === true;
}

export function useCanSwitchTenant() {
  const isPlatformAdmin = useIsPlatformAdmin();
  const { data } = useMemberships();
  return canSwitchTenant({ membershipCount: data?.length ?? 0, isPlatformAdmin });
}

export function useSelectTenant() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.tenant.select.mutationOptions({
      onSuccess: async (active) => {
        // Reset rather than just invalidate: data cached under the previous organization must not
        // flash on screen while the new one loads.
        await qc.resetQueries();
        qc.setQueryData(trpc.tenant.active.queryKey(), active);
        broadcastSessionChange('tenant-changed');
      },
      onError,
    }),
  );

  const { mutateAsync } = mutation;
  const selectTenant = useCallback(
    (organizationId: string) => mutateAsync({ organizationId }),
    [mutateAsync],
  );

  return { selectTenant, isPending: mutation.isPending };
}
