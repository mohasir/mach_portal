'use client';
import { useEffect } from 'react';
import { Flex, Spin } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { usePermissions } from '@/features/tenant/hooks/usePermissions';
import { useCan } from './useCan';
import { resolveGuardOutcome } from './routeGuardOutcome';

/** Renders children only when the active role may open the current route. */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const can = useCan();
  const { access } = usePermissions();

  const outcome = resolveGuardOutcome({ pathname, can, ready: access !== undefined });
  const target = typeof outcome === 'object' ? outcome.redirect : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (outcome !== 'allow') {
    return (
      <Flex justify="center" align="center" className="min-h-full">
        <Spin />
      </Flex>
    );
  }
  return <>{children}</>;
}
