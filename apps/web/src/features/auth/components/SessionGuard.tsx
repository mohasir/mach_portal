'use client';
import { useEffect } from 'react';
import { Button, Flex, Result, Spin } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { signOut, useSession } from '@/lib/auth/client';

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('auth');
  const { data: session, isPending, error, refetch } = useSession();
  const router = useRouter();

  const isServerError = !!error && error.status !== 401;

  useEffect(() => {
    if (isPending || isServerError || session) return;
    let active = true;
    void signOut().finally(() => {
      if (active) router.replace('/login');
    });
    return () => {
      active = false;
    };
  }, [isPending, isServerError, session, router]);

  if (isServerError) {
    return (
      <Flex justify="center" align="center" className="min-h-screen p-6">
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
      <Flex justify="center" align="center" className="min-h-screen">
        <Spin />
      </Flex>
    );
  }

  return <>{children}</>;
}
