'use client';
import { useQuery } from '@tanstack/react-query';
import { FEATURE_KEYS, isToggleable, type FeatureKey } from '@repo/guards';
import { useTRPC, useTRPCClient } from '@/lib/trpc/client';
import { organizationScopedKey } from '../permissions';
import { useActiveOrganizationId } from './useTenant';

const CORE_KEYS = FEATURE_KEYS.filter((key) => !isToggleable(key));

// Core features are never toggled off, so they are not taken from the response.
const toKeySet = (data: { features: { key: FeatureKey }[] }): ReadonlySet<FeatureKey> =>
  new Set<FeatureKey>([...CORE_KEYS, ...data.features.map((f) => f.key)]);

const FEATURES_STALE_MS = 30_000;

/** The features active in the organization; only the core ones until the query resolves. */
export function useFeatures(): { keys: ReadonlySet<FeatureKey>; isPending: boolean } {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const organizationId = useActiveOrganizationId();

  const query = useQuery({
    queryKey: organizationScopedKey(trpc.features.mine.queryKey(), organizationId),
    queryFn: () => client.features.mine.query(),
    enabled: !!organizationId,
    staleTime: FEATURES_STALE_MS,
    refetchOnWindowFocus: true,
    select: toKeySet,
  });

  return { keys: query.data ?? new Set<FeatureKey>(CORE_KEYS), isPending: query.isPending };
}
