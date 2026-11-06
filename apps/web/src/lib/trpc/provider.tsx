'use client';
import { useEffect, useRef, useState } from 'react';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink, loggerLink } from '@trpc/client';
import type { AppRouter } from 'api';
import { usePathname, useRouter } from 'next/navigation';
import { SELECT_ORGANIZATION_ROUTE } from '@/lib/auth/navigation';
import { isTenantAccessError } from '@/lib/error/apiErrorCode';
import { TRPCProvider } from './client';

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const onTenantAccessError = useRef(() => {});
  useEffect(() => {
    onTenantAccessError.current = () => {
      if (pathname !== SELECT_ORGANIZATION_ROUTE) router.replace(SELECT_ORGANIZATION_ROUTE);
    };
  });

  // Any request that lost its active organization sends the user back to pick one.
  const handleError = (error: unknown) => {
    if (isTenantAccessError(error)) onTenantAccessError.current();
  };

  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: handleError }),
        mutationCache: new MutationCache({ onError: handleError }),
        defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
      }),
  );

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({ enabled: () => process.env.NODE_ENV === 'development' }),
        httpBatchLink({
          url: '/trpc',
          // The API rejects batches above its maxBatchSize (20).
          maxItems: 20,
          fetch: (url, opts) => fetch(url, { ...opts, credentials: 'include' }),
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
