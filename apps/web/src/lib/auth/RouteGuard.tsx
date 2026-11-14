'use client';
import { useEffect } from 'react';
import { Flex, Spin } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { NotFound } from '@/components/shared/NotFound';
import { useFeatures } from '@/features/tenant/hooks/useFeatures';
import { usePermissions } from '@/features/tenant/hooks/usePermissions';
import { DEFAULT_REDIRECT_HOME } from './navigation';
import { useCan } from './useCan';
import { resolveGuardOutcome } from './routeGuardOutcome';

/** Renders children only when the active role may open the current route. */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const can = useCan();
  const { access } = usePermissions();

  const { keys, isPending: featuresPending } = useFeatures();

  const outcome = resolveGuardOutcome({
    pathname,
    can,
    ready: access !== undefined,
    hasFeature: (key) => keys.has(key),
    featuresReady: !featuresPending,
  });
  const target = typeof outcome === 'object' ? outcome.redirect : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  // Mounted inside the admin layout, so the 404 renders in the content area like any unknown page.
  if (outcome === 'notFound') return <NotFound home={DEFAULT_REDIRECT_HOME} />;

  if (outcome !== 'allow') {
    return (
      <Flex justify="center" align="center" className="min-h-full">
        <Spin />
      </Flex>
    );
  }
  return <>{children}</>;
}
