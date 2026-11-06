'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Flex, Result, Spin, Typography } from 'antd';
import { Building2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { DEFAULT_REDIRECT_HOME } from '@/lib/auth/navigation';
import { shouldAutoSelect } from '../helpers';
import {
  useActiveTenant,
  useAllOrganizations,
  useIsPlatformAdmin,
  useMemberships,
  useSelectTenant,
} from '../hooks/useTenant';
import { useSignOut } from '../hooks/useSignOut';
import type { Organization } from '../types';
import { OrganizationList } from './OrganizationList';
import { OrganizationSearchList } from './OrganizationSearchList';

export function SelectOrganizationPage() {
  const { t } = useTranslation('tenant');
  const router = useRouter();
  const isPlatformAdmin = useIsPlatformAdmin();
  const memberships = useMemberships();
  const allOrganizations = useAllOrganizations(isPlatformAdmin);
  const active = useActiveTenant();
  const { selectTenant, isPending } = useSelectTenant();
  const [pendingId, setPendingId] = useState<string>();
  const autoSelectTried = useRef(false);
  const [autoSelectFailed, setAutoSelectFailed] = useState(false);

  const choose = useCallback(
    async (organizationId: string) => {
      setPendingId(organizationId);
      try {
        await selectTenant(organizationId);
        router.replace(DEFAULT_REDIRECT_HOME);
        return true;
      } catch {
        setPendingId(undefined);
        return false;
      }
    },
    [selectTenant, router],
  );

  const mine = memberships.data;
  const activeLoaded = active.isSuccess;
  const activeId = active.data?.id ?? null;
  const autoSelectId =
    mine && activeLoaded ? shouldAutoSelect({ memberships: mine, activeTenantId: activeId }) : null;

  useEffect(() => {
    if (!autoSelectId || autoSelectTried.current) return;
    autoSelectTried.current = true;
    void choose(autoSelectId).then((ok) => setAutoSelectFailed(!ok));
  }, [autoSelectId, choose]);

  const onSignOut = useSignOut();

  const signOutButton = (
    <Button block type="text" icon={<LogOut size={16} />} onClick={onSignOut}>
      {t('select.signOut')}
    </Button>
  );

  if (memberships.isError || (isPlatformAdmin && allOrganizations.isError)) {
    return (
      <Result
        status="error"
        title={t('select.loadError')}
        extra={
          <Button
            type="primary"
            onClick={() => {
              void memberships.refetch();
              if (isPlatformAdmin) void allOrganizations.refetch();
            }}
          >
            {t('select.retry')}
          </Button>
        }
      />
    );
  }

  const loading =
    memberships.isPending ||
    active.isPending ||
    (isPlatformAdmin && allOrganizations.isPending) ||
    (!!autoSelectId && !autoSelectFailed);
  if (loading) {
    return (
      <Flex justify="center" className="py-10">
        <Spin />
      </Flex>
    );
  }

  const mineList = mine ?? [];
  const allList = allOrganizations.data ?? [];

  if (!mineList.length && !allList.length) {
    return (
      <Flex vertical align="center" gap={12} className="py-4 text-center">
        <Building2 size={40} className="text-muted" />
        <Typography.Title level={4} className="m-0">
          {t('empty.title')}
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="m-0">
          {t('empty.subtitle')}
        </Typography.Paragraph>
        {signOutButton}
      </Flex>
    );
  }

  const listProps = {
    activeId,
    pendingId,
    disabled: isPending,
    onSelect: (org: Organization) => void choose(org.id),
  };

  return (
    <Flex vertical gap={16}>
      <div>
        <Typography.Title level={3} className="font-heading text-center">
          {t('select.title')}
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="m-0 text-center">
          {t('select.subtitle')}
        </Typography.Paragraph>
      </div>

      {mineList.length > 0 && (
        <Flex vertical gap={8}>
          {isPlatformAdmin && <Typography.Text strong>{t('select.mine')}</Typography.Text>}
          <OrganizationList items={mineList} {...listProps} />
        </Flex>
      )}

      {isPlatformAdmin && (
        <Flex vertical gap={8}>
          <Typography.Text strong>{t('select.all')}</Typography.Text>
          <OrganizationSearchList items={allList} {...listProps} />
        </Flex>
      )}

      {signOutButton}
    </Flex>
  );
}
