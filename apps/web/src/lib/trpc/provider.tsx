'use client';
import { useEffect, useRef, useState } from 'react';
import { App } from 'antd';
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
  matchQuery,
  type Query,
} from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink, loggerLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import type { AppRouter } from 'api';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  createPermissionsFetch,
  handlePermissionDenial,
  watchPermissionsChanges,
  type PermissionsFilters,
} from '@/features/tenant';
import { SELECT_ORGANIZATION_ROUTE } from '@/lib/auth/navigation';
import { isPermissionDeniedError, isTenantAccessError } from '@/lib/error/apiErrorCode';
import { TRPCProvider } from './client';

const PERMISSIONS_NOTICE_KEY = 'permissions-notice';

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { message } = App.useApp();
  const { t } = useTranslation('tenant');

  const onTenantAccessError = useRef(() => {});
  const onPermissionsNotice = useRef((_notice: 'changed' | 'lost') => {});
  useEffect(() => {
    onTenantAccessError.current = () => {
      if (pathname !== SELECT_ORGANIZATION_ROUTE) router.replace(SELECT_ORGANIZATION_ROUTE);
    };
    // A fixed key collapses the notices of several requests settling at once into one.
    onPermissionsNotice.current = (notice) => {
      message.warning({ key: PERMISSIONS_NOTICE_KEY, content: t(`permissions.${notice}`) });
    };
  });

  const [clients] = useState(() => {
    let filters: PermissionsFilters | undefined;
    let accessLost = false;

    const handleError = (error: unknown, query?: Query<unknown, unknown, unknown>) => {
      // Any request that lost its active organization sends the user back to pick one.
      if (isTenantAccessError(error)) {
        onTenantAccessError.current();
        return;
      }
      // A denial may mean the role changed underneath the screen; the notice for a real change
      // comes from the change watcher once the revalidated permissions arrive.
      if (filters && isPermissionDeniedError(error)) {
        if (handlePermissionDenial(queryClient, filters, query, accessLost) === 'lost') {
          accessLost = true;
          onPermissionsNotice.current('lost');
        }
      }
    };

    // Permissions that load again (focus refetch, another organization) end the lost state and
    // restart the version poll, which stopped on its denial.
    const handleSuccess = (query: Query<unknown, unknown, unknown>) => {
      if (!accessLost || !filters || !matchQuery(filters.permissions, query)) return;
      accessLost = false;
      void queryClient.invalidateQueries(filters.version);
    };

    const queryClient = new QueryClient({
      queryCache: new QueryCache({
        onError: (error, query) => handleError(error, query),
        onSuccess: (_data, query) => handleSuccess(query),
      }),
      mutationCache: new MutationCache({ onError: (error) => handleError(error) }),
      defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
    });

    const includeCredentials = (url: RequestInfo | URL, opts?: RequestInit) =>
      fetch(url, { ...opts, credentials: 'include' });
    // Swapped for the version-aware fetch once the query filters exist; no request runs before that.
    let transport = includeCredentials;

    const trpcClient = createTRPCClient<AppRouter>({
      links: [
        loggerLink({ enabled: () => process.env.NODE_ENV === 'development' }),
        httpBatchLink({
          url: '/trpc',
          // The API rejects batches above its maxBatchSize (20).
          maxItems: 20,
          fetch: (url, opts) => transport(url, opts),
        }),
      ],
    });

    const trpc = createTRPCOptionsProxy<AppRouter>({ client: trpcClient, queryClient });
    filters = {
      permissions: trpc.tenant.permissions.queryFilter(),
      version: trpc.tenant.permissionsVersion.queryFilter(),
      active: trpc.tenant.active.queryFilter(),
    };
    transport = createPermissionsFetch(includeCredentials, queryClient, filters);
    // Lives as long as the client itself, so it is never unsubscribed.
    watchPermissionsChanges(queryClient.getQueryCache(), filters.permissions, () =>
      onPermissionsNotice.current('changed'),
    );

    return { queryClient, trpcClient };
  });

  return (
    <QueryClientProvider client={clients.queryClient}>
      <TRPCProvider trpcClient={clients.trpcClient} queryClient={clients.queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
