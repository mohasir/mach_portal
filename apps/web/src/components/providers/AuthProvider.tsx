'use client';
import { useEffect, useRef } from 'react';
import { Button, Flex, Result, Spin } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth/client';
import { DEFAULT_REDIRECT_LOGIN, isProtectedRoute } from '@/lib/auth/navigation';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('auth');
  const { data: session, isPending, error, refetch } = useSession();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const redirected = useRef(false);

  const protectedRoute = isProtectedRoute(pathname);
  const isServerError = !!error && error.status !== 401;

  useEffect(() => {
    if (!protectedRoute || isPending || isServerError) return;
    if (session) {
      redirected.current = false;
      return;
    }
    if (redirected.current) return;
    redirected.current = true;
    router.replace(DEFAULT_REDIRECT_LOGIN);
  }, [protectedRoute, isPending, isServerError, session, router]);

  if (!protectedRoute) return <>{children}</>;

  if (isServerError) {
    return (
      <Flex justify="center" align="center" className="min-h-dvh p-6">
        <Result
          status="500"
          title={t('session.errorTitle')}
          subTitle={t('session.errorSubtitle')}
          extra={
            <Button type="primary" onClick={() => refetch()}>
              {t('session.retry')}
            </Button>
          }
        />
      </Flex>
    );
  }

  if (isPending || !session) {
    return (
      <Flex justify="center" align="center" className="min-h-dvh">
        <Spin />
      </Flex>
    );
  }

  return <>{children}</>;
}
