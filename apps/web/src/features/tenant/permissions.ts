import {
  matchQuery,
  type Query,
  type QueryCache,
  type QueryClient,
  type QueryFilters,
  type QueryKey,
} from '@tanstack/react-query';
import type { AccessGrants } from '@repo/guards';
import { isPermissionDeniedError } from '@/lib/error/apiErrorCode';

/** Response header the API sets on every tenant-scoped call: `<roleId>:<roleVersion>`. */
export const PERMISSIONS_VERSION_HEADER = 'x-permissions-version';

export const PERMISSIONS_POLL_INTERVAL_MS = 45_000;

export type PermissionsFilters = {
  permissions: QueryFilters;
  version: QueryFilters;
  /** `tenant.active`: rechecked when access is lost, so the gate leaves an organization it lost. */
  active: QueryFilters;
};

/** Version poll interval: it stops once the poll is denied, as every later poll would be too. */
export function permissionsPollInterval(lastError: unknown): number | false {
  return isPermissionDeniedError(lastError) ? false : PERMISSIONS_POLL_INTERVAL_MS;
}

// The procedures take no input, so the organization is appended to the key: switching
// organization must never serve the previous one's permissions from the cache.
export function organizationScopedKey(key: QueryKey, organizationId: string | undefined): QueryKey {
  return [...key, { organizationId: organizationId ?? null }];
}

/**
 * Refetches the loaded permissions when a response reports another version. Returns whether it did.
 * Skipped with nothing loaded yet or a refetch already in flight: that refetch settles on the new
 * version by itself, and invalidating again on every response would restart it in a loop.
 */
export function refreshPermissionsIfStale(
  qc: QueryClient,
  filter: QueryFilters,
  received: string | null | undefined,
): boolean {
  if (!received) return false;
  const queries = qc.getQueryCache().findAll({ ...filter, type: 'active' });
  if (queries.some((query) => query.state.fetchStatus === 'fetching')) return false;

  const stale = queries.some((query) => {
    const loaded = (query.state.data as { version?: string } | undefined)?.version;
    return loaded !== undefined && loaded !== received;
  });
  if (stale) void qc.invalidateQueries(filter);
  return stale;
}

/** Wraps the tRPC transport so every response's version header can refresh stale permissions. */
export function createPermissionsFetch<TArgs extends unknown[]>(
  baseFetch: (...args: TArgs) => Promise<Response>,
  qc: QueryClient,
  filters: PermissionsFilters,
): (...args: TArgs) => Promise<Response> {
  return async (...args) => {
    const response = await baseFetch(...args);
    refreshPermissionsIfStale(
      qc,
      filters.permissions,
      response.headers.get(PERMISSIONS_VERSION_HEADER),
    );
    return response;
  };
}

type PermissionsData = AccessGrants & { roleName: string | null; version: string };

export function toPermissionsState(data: PermissionsData | undefined): {
  access: AccessGrants | undefined;
  role: { name: string; isOwner: boolean } | undefined;
  version: string | undefined;
} {
  if (!data) return { access: undefined, role: undefined, version: undefined };
  return {
    access: { isOwner: data.isOwner, grants: data.grants },
    // Owner access without a membership (a platform admin) has no role name; it shows as the owner.
    role: { name: data.roleName ?? '', isOwner: data.isOwner },
    version: data.version,
  };
}

export type DenialDecision = 'revalidate' | 'announce-lost' | 'ignore';

/**
 * A denial of the permissions queries themselves means the membership or its role is gone; it is
 * announced once, and every later denial stays silent until the permissions load again, since
 * refetching or announcing would only repeat it. Any other denial revalidates the permissions.
 */
export function decidePermissionDenial(
  ownQueryDenied: boolean,
  accessLost: boolean,
): DenialDecision {
  if (accessLost) return 'ignore';
  return ownQueryDenied ? 'announce-lost' : 'revalidate';
}

export type DenialOutcome = 'revalidated' | 'lost' | 'ignored';

/**
 * Reacts to a permission gate's denial (see `decidePermissionDenial`). On a revalidation the change
 * watcher decides whether anything really changed.
 */
export function handlePermissionDenial(
  qc: QueryClient,
  filters: PermissionsFilters,
  failed?: Query<unknown, unknown, unknown>,
  accessLost = false,
): DenialOutcome {
  const ownQueryDenied =
    !!failed && (matchQuery(filters.permissions, failed) || matchQuery(filters.version, failed));
  const decision = decidePermissionDenial(ownQueryDenied, accessLost);
  if (decision === 'ignore') return 'ignored';
  if (decision === 'announce-lost') {
    void qc.invalidateQueries(filters.active);
    return 'lost';
  }
  void qc.invalidateQueries(filters.permissions, { cancelRefetch: false });
  return 'revalidated';
}

/**
 * Calls `onChange` when a loaded permissions version is replaced by a different one in the same
 * query. A reset or removed query starts over, so a new sign-in or organization is never a change,
 * and a denial whose refetch returns the same version stays silent. Returns the unsubscribe.
 */
export function watchPermissionsChanges(
  cache: QueryCache,
  filter: QueryFilters,
  onChange: () => void,
): () => void {
  const loaded = new Map<string, string>();
  return cache.subscribe((event) => {
    if (!matchQuery(filter, event.query)) return;
    const hash = event.query.queryHash;
    if (event.type === 'removed') {
      loaded.delete(hash);
      return;
    }
    if (event.type !== 'updated') return;
    const version = (event.query.state.data as { version?: string } | undefined)?.version;
    const previous = loaded.get(hash);
    if (version === undefined) {
      loaded.delete(hash);
      return;
    }
    loaded.set(hash, version);
    if (previous !== undefined && previous !== version) onChange();
  });
}
