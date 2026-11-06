'use client';
import { useEffect } from 'react';
import { Button, Flex, Result, Spin } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { SELECT_ORGANIZATION_ROUTE } from '@/lib/auth/navigation';
import { useTenantSync } from '../hooks/useTenantSync';
import { useActiveTenant } from '../hooks/useTenant';
import { PlatformModeBanner } from './PlatformModeBanner';

/** Authenticated-area guard: renders only once the API confirms an active organization. */
export function TenantGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('tenant');
  const router = useRouter();
  const { data: tenant, isPending, isError, refetch } = useActiveTenant();
  useTenantSync();

  const missing = !isPending && !isError && tenant === null;

  useEffect(() => {
    if (missing) router.replace(SELECT_ORGANIZATION_ROUTE);
  }, [missing, router]);

  if (isError) {
    return (
      <Flex justify="center" align="center" className="min-h-full p-6">
        <Result
          status="500"
          title={t('gate.errorTitle')}
          subTitle={t('gate.errorSubtitle')}
          extra={
            <Button type="primary" onClick={() => refetch()}>
              {t('gate.retry')}
            </Button>
          }
        />
      </Flex>
    );
  }

  if (isPending || !tenant) {
    return (
      <Flex justify="center" align="center" className="min-h-full">
        <Spin />
      </Flex>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {tenant.isPlatformAccess && <PlatformModeBanner name={tenant.name} />}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
