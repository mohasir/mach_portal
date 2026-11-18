'use client';
import { Flex, Spin } from 'antd';
import { NotFound } from '@/components/shared/NotFound';
import { useIsPlatformAdmin } from '@/features/tenant';
import { useSession } from '@/lib/auth/client';
import { ROOT_ROUTE } from '@/lib/auth/navigation';
import { resolveConsoleAccess } from '../helpers';

/** Hides the console from everyone who is not a platform admin, without revealing it exists. */
export function ConsoleGuard({ children }: { children: React.ReactNode }) {
  const { isPending } = useSession();
  const isPlatformAdmin = useIsPlatformAdmin();
  const access = resolveConsoleAccess({ isPending, isPlatformAdmin });

  if (access === 'notFound') return <NotFound home={ROOT_ROUTE} fullScreen />;
  if (access === 'loading') {
    return (
      <Flex justify="center" align="center" className="min-h-full">
        <Spin />
      </Flex>
    );
  }
  return <>{children}</>;
}
