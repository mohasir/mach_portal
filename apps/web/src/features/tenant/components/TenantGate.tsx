'use client';
import { useEffect } from 'react';
import { Button, Flex, Result, Spin } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { SELECT_ORGANIZATION_ROUTE } from '@/lib/auth/navigation';
import { resolveGateState } from '../helpers';
import { usePermissions, usePermissionsSync } from '../hooks/usePermissions';
import { useTenantSync } from '../hooks/useTenantSync';
import { useActiveTenant } from '../hooks/useTenant';
import { PlatformModeBanner } from './PlatformModeBanner';

/**
 * Authenticated-area guard: renders only once the API confirms an active organization and the
 * caller's permissions in it are loaded.
 */
export function TenantGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('tenant');
  const router = useRouter();
  const tenantQuery = useActiveTenant();
  const permissions = usePermissions();
  useTenantSync();
  usePermissionsSync();

  const tenant = tenantQuery.data;
  const state = resolveGateState({
    tenantPending: tenantQuery.isPending,
    tenantError: tenantQuery.isError,
    tenant,
    hasPermissions: permissions.access !== undefined,
    permissionsError: permissions.isError,
  });

  useEffect(() => {
    if (state === 'redirect') router.replace(SELECT_ORGANIZATION_ROUTE);
  }, [state, router]);

  if (state === 'tenantError' || state === 'permissionsError') {
    const tenantFailed = state === 'tenantError';
    return (
      <Flex justify="center" align="center" className="min-h-full p-6">
        <Result
          status="500"
          title={tenantFailed ? t('gate.errorTitle') : t('gate.permissionsErrorTitle')}
          subTitle={t('gate.errorSubtitle')}
          extra={
            <Button
              type="primary"
              onClick={() => (tenantFailed ? tenantQuery.refetch() : permissions.refetch())}
            >
              {t('gate.retry')}
            </Button>
          }
        />
      </Flex>
    );
  }

  if (state !== 'ready' || !tenant) {
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
