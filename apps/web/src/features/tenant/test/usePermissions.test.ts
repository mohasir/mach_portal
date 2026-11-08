import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver, type QueryObserverOptions } from '@tanstack/react-query';
import { createTRPCClient, TRPCClientError } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import type { AppRouter } from 'api';

type Permissions = {
  isOwner: boolean;
  grants: Record<string, 'own' | 'all'>;
  roleName: string | null;
  version: string;
};

const env = vi.hoisted(() => ({
  organizationId: undefined as string | undefined,
  server: { version: 'r1:1' },
  permissionsCalls: [] as string[],
  versionCalls: 0,
  captured: [] as unknown[],
  queryClient: null as unknown,
}));

const proxyQueryClient = new QueryClient();
const trpc = createTRPCOptionsProxy<AppRouter>({
  client: createTRPCClient<AppRouter>({ links: [] }),
  queryClient: proxyQueryClient,
});

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: (options: unknown) => {
    env.captured.push(options);
    return { data: undefined, isPending: true, isError: false, refetch: vi.fn() };
  },
  useQueryClient: () => env.queryClient,
}));

vi.mock('@/lib/trpc/client', () => ({
  useTRPC: () => trpc,
  useTRPCClient: () => ({
    tenant: {
      permissions: {
        query: async (): Promise<Permissions> => {
          env.permissionsCalls.push(env.organizationId ?? 'none');
          return {
            isOwner: false,
            grants: { 'quote.read': 'all' },
            roleName: 'Sales',
            version: env.server.version,
          };
        },
      },
      permissionsVersion: {
        query: async () => {
          env.versionCalls += 1;
          return { version: env.server.version };
        },
      },
    },
  }),
}));

vi.mock('../hooks/useTenant', () => ({
  useActiveOrganizationId: () => env.organizationId,
}));

import { usePermissions, usePermissionsSync } from '../hooks/usePermissions';
import {
  createPermissionsFetch,
  PERMISSIONS_POLL_INTERVAL_MS,
  PERMISSIONS_VERSION_HEADER,
  refreshPermissionsIfStale,
  toPermissionsState,
  handlePermissionDenial,
  decidePermissionDenial,
  permissionsPollInterval,
  watchPermissionsChanges,
} from '../permissions';

const permissionsFilter = trpc.tenant.permissions.queryFilter();
const filters = {
  permissions: permissionsFilter,
  version: trpc.tenant.permissionsVersion.queryFilter(),
  active: trpc.tenant.active.queryFilter(),
};

function capturePermissionsOptions() {
  env.captured = [];
  usePermissions();
  return env.captured[0] as QueryObserverOptions<Permissions>;
}

let qc: QueryClient;
let unsubscribe: (() => void) | undefined;

async function observe(options: QueryObserverOptions<Permissions>) {
  const observer = new QueryObserver<Permissions>(qc, options);
  unsubscribe = observer.subscribe(() => {});
  await vi.waitFor(() => expect(observer.getCurrentResult().fetchStatus).toBe('idle'));
  return observer;
}

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  env.queryClient = qc;
  env.organizationId = 'org-a';
  env.server = { version: 'r1:1' };
  env.permissionsCalls = [];
  env.versionCalls = 0;
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = undefined;
  qc.clear();
});

describe('usePermissions', () => {
  it('scopes the query to the active organization and always revalidates', () => {
    const optionsA = capturePermissionsOptions();
    env.organizationId = 'org-b';
    const optionsB = capturePermissionsOptions();

    expect(optionsA.staleTime).toBe(0);
    expect(optionsA.enabled).toBe(true);
    expect(optionsA.queryKey).not.toEqual(optionsB.queryKey);
  });

  it('waits for an active organization before asking', () => {
    env.organizationId = undefined;
    expect(capturePermissionsOptions().enabled).toBe(false);
  });

  it('asks again when the organization changes', async () => {
    const observer = await observe(capturePermissionsOptions());
    env.organizationId = 'org-b';
    observer.setOptions(capturePermissionsOptions());
    await vi.waitFor(() => expect(env.permissionsCalls).toEqual(['org-a', 'org-b']));
  });

  it('asks again when a response carries a different version', async () => {
    await observe(capturePermissionsOptions());
    env.server.version = 'r1:2';

    expect(refreshPermissionsIfStale(qc, permissionsFilter, 'r1:2')).toBe(true);
    await vi.waitFor(() => expect(env.permissionsCalls).toHaveLength(2));
    expect(refreshPermissionsIfStale(qc, permissionsFilter, 'r1:2')).toBe(false);
  });

  it('ignores a matching or missing version header', async () => {
    await observe(capturePermissionsOptions());
    expect(refreshPermissionsIfStale(qc, permissionsFilter, 'r1:1')).toBe(false);
    expect(refreshPermissionsIfStale(qc, permissionsFilter, null)).toBe(false);
    expect(env.permissionsCalls).toHaveLength(1);
  });

  it('does nothing before any permissions are loaded or while a refetch is in flight', async () => {
    expect(refreshPermissionsIfStale(qc, permissionsFilter, 'r1:9')).toBe(false);

    const observer = await observe(capturePermissionsOptions());
    void observer.refetch();
    expect(refreshPermissionsIfStale(qc, permissionsFilter, 'r1:9')).toBe(false);
    await vi.waitFor(() => expect(env.permissionsCalls).toHaveLength(2));
  });
});

describe('usePermissionsSync', () => {
  it('polls the version every 45 seconds, scoped to the organization', () => {
    env.captured = [];
    usePermissionsSync();
    const options = env.captured[0] as QueryObserverOptions;

    expect(PERMISSIONS_POLL_INTERVAL_MS).toBe(45_000);
    const interval = options.refetchInterval as (query: { state: { error: unknown } }) => unknown;
    expect(interval({ state: { error: null } })).toBe(PERMISSIONS_POLL_INTERVAL_MS);
    expect(options.staleTime).toBe(0);
    expect(options.refetchOnWindowFocus).toBe(false);
    expect(options.queryKey).toEqual(
      expect.arrayContaining([expect.objectContaining({ organizationId: 'org-a' })]),
    );
  });

  it('refreshes the permissions when the polled version moved', async () => {
    await observe(capturePermissionsOptions());
    env.captured = [];
    usePermissionsSync();
    const pollOptions = env.captured[0] as QueryObserverOptions;

    env.server.version = 'r1:2';
    await qc.fetchQuery({ queryKey: pollOptions.queryKey, queryFn: pollOptions.queryFn as never });

    expect(env.versionCalls).toBe(1);
    await vi.waitFor(() => expect(env.permissionsCalls).toHaveLength(2));
  });
});

describe('handlePermissionDenial', () => {
  it('refetches the permissions after another request is denied', async () => {
    await observe(capturePermissionsOptions());
    expect(handlePermissionDenial(qc, filters)).toBe('revalidated');
    await vi.waitFor(() => expect(env.permissionsCalls).toHaveLength(2));
  });

  it('reports lost access when the permissions query itself is denied, without looping', async () => {
    const observer = await observe(capturePermissionsOptions());
    const own = qc.getQueryCache().find<unknown, unknown>({ queryKey: observer.options.queryKey })!;
    expect(handlePermissionDenial(qc, filters, own)).toBe('lost');
    expect(env.permissionsCalls).toHaveLength(1);
  });

  it('rechecks the active organization when access is lost, so the gate can leave it', async () => {
    let activeCalls = 0;
    const active = new QueryObserver(qc, {
      queryKey: trpc.tenant.active.queryKey(),
      queryFn: async () => {
        activeCalls += 1;
        return null;
      },
    });
    const stop = active.subscribe(() => {});
    await vi.waitFor(() => expect(activeCalls).toBe(1));
    const observer = await observe(capturePermissionsOptions());
    const own = qc.getQueryCache().find<unknown, unknown>({ queryKey: observer.options.queryKey })!;

    expect(handlePermissionDenial(qc, filters, own)).toBe('lost');
    await vi.waitFor(() => expect(activeCalls).toBe(2));
    expect(handlePermissionDenial(qc, filters, own, true)).toBe('ignored');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(activeCalls).toBe(2);
    stop();
  });
});

describe('permissionsPollInterval', () => {
  const denied = Object.assign(new TRPCClientError('denied'), {
    data: { errorCode: null, code: 'FORBIDDEN' },
  });

  it('polls every 45 seconds while the version answers', () => {
    expect(permissionsPollInterval(null)).toBe(PERMISSIONS_POLL_INTERVAL_MS);
    expect(permissionsPollInterval(new Error('network'))).toBe(PERMISSIONS_POLL_INTERVAL_MS);
  });

  it('stops once the version request is denied, since every later poll would be denied too', () => {
    expect(permissionsPollInterval(denied)).toBe(false);
  });
});

describe('decidePermissionDenial', () => {
  it('announces lost access the first time the permissions themselves are denied', () => {
    expect(decidePermissionDenial(true, false)).toBe('announce-lost');
  });

  it('revalidates the permissions when another request is denied', () => {
    expect(decidePermissionDenial(false, false)).toBe('revalidate');
  });

  it('stays silent after access was already reported lost, whatever request is denied', () => {
    expect(decidePermissionDenial(true, true)).toBe('ignore');
    expect(decidePermissionDenial(false, true)).toBe('ignore');
  });
});

describe('handlePermissionDenial once access is lost', () => {
  it('neither refetches nor reports lost again', async () => {
    const observer = await observe(capturePermissionsOptions());
    const own = qc.getQueryCache().find<unknown, unknown>({ queryKey: observer.options.queryKey })!;
    expect(handlePermissionDenial(qc, filters, own, true)).toBe('ignored');
    expect(handlePermissionDenial(qc, filters, undefined, true)).toBe('ignored');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(env.permissionsCalls).toHaveLength(1);
  });
});

describe('watchPermissionsChanges', () => {
  const key = () => capturePermissionsOptions().queryKey;
  const load = (version: string, queryKey = key()) =>
    qc.setQueryData(queryKey, { isOwner: false, grants: {}, roleName: 'Sales', version });

  function watch() {
    const onChange = vi.fn();
    unsubscribe = watchPermissionsChanges(qc.getQueryCache(), permissionsFilter, onChange);
    return onChange;
  }

  it('fires only when a loaded version is replaced by a different one', () => {
    const onChange = watch();
    load('r1:1');
    expect(onChange).not.toHaveBeenCalled();
    load('r1:1');
    expect(onChange).not.toHaveBeenCalled();
    load('r1:2');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('stays quiet after a denial that left the version as it was', async () => {
    const onChange = watch();
    await observe(capturePermissionsOptions());
    expect(handlePermissionDenial(qc, filters)).toBe('revalidated');
    await vi.waitFor(() => expect(env.permissionsCalls).toHaveLength(2));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('fires when a denial reveals that the role changed', async () => {
    const onChange = watch();
    await observe(capturePermissionsOptions());
    env.server.version = 'r1:2';
    handlePermissionDenial(qc, filters);
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  });

  it('starts over after a reset or a clear, so a new sign-in is not a change', async () => {
    const onChange = watch();
    load('r1:1');
    await qc.resetQueries(permissionsFilter);
    load('r9:1');
    qc.clear();
    load('r7:1');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('compares each organization with itself only', () => {
    const onChange = watch();
    load('a:1');
    env.organizationId = 'org-b';
    load('b:1');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores other queries', () => {
    const onChange = watch();
    qc.setQueryData(['other'], { version: 'x' });
    qc.setQueryData(['other'], { version: 'y' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('createPermissionsFetch', () => {
  const respondWith = (version?: string) =>
    vi.fn(
      async (_url: string) =>
        new Response('{}', {
          headers: version ? { [PERMISSIONS_VERSION_HEADER]: version } : {},
        }),
    );

  it('passes the response through and refreshes when the header differs from the loaded version', async () => {
    await observe(capturePermissionsOptions());
    env.server.version = 'r1:2';
    const base = respondWith('r1:2');
    const response = await createPermissionsFetch(base, qc, filters)('/trpc/x');

    expect(base).toHaveBeenCalledWith('/trpc/x');
    expect(response.headers.get(PERMISSIONS_VERSION_HEADER)).toBe('r1:2');
    await vi.waitFor(() => expect(env.permissionsCalls).toHaveLength(2));
  });

  it('does nothing when the header matches or is absent', async () => {
    await observe(capturePermissionsOptions());
    await createPermissionsFetch(respondWith('r1:1'), qc, filters)('/trpc/x');
    await createPermissionsFetch(respondWith(), qc, filters)('/trpc/x');
    expect(env.permissionsCalls).toHaveLength(1);
  });

  it('does nothing before any version is loaded', async () => {
    await createPermissionsFetch(respondWith('r1:9'), qc, filters)('/trpc/x');
    expect(env.permissionsCalls).toHaveLength(0);
  });

  it('does nothing while a permissions refetch is in flight', async () => {
    const observer = await observe(capturePermissionsOptions());
    void observer.refetch();
    await createPermissionsFetch(respondWith('r1:9'), qc, filters)('/trpc/x');
    await vi.waitFor(() => expect(observer.getCurrentResult().fetchStatus).toBe('idle'));
    expect(env.permissionsCalls).toHaveLength(2);
  });
});

describe('toPermissionsState', () => {
  it('exposes the grants, the role and the version once loaded', () => {
    expect(
      toPermissionsState({
        isOwner: false,
        grants: { 'quote.read': 'own' },
        roleName: 'Sales',
        version: 'r1:3',
      }),
    ).toEqual({
      access: { isOwner: false, grants: { 'quote.read': 'own' } },
      role: { name: 'Sales', isOwner: false },
      version: 'r1:3',
    });
  });

  it('describes owner access without a membership role as the owner', () => {
    expect(
      toPermissionsState({ isOwner: true, grants: {}, roleName: null, version: 'owner:0' }).role,
    ).toEqual({ name: '', isOwner: true });
  });

  it('is empty while nothing is loaded', () => {
    expect(toPermissionsState(undefined)).toEqual({
      access: undefined,
      role: undefined,
      version: undefined,
    });
  });
});
