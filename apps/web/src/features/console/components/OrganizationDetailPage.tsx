'use client';
import { Button, Result, Skeleton, Tabs, Tag, Typography } from 'antd';
import { ArrowLeft, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { NotFound } from '@/components/shared/NotFound';
import { useSelectTenant } from '@/features/tenant';
import { CONSOLE_ROUTE, DEFAULT_REDIRECT_HOME } from '@/lib/auth/navigation';
import { getApiErrorCode } from '@/lib/error/apiErrorCode';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useOrganization } from '../hooks/useOrganization';
import { CatalogTab } from './CatalogTab';
import { FeaturesTab } from './FeaturesTab';
import { HistoryTab } from './HistoryTab';
import { SummaryTab } from './SummaryTab';

const ORGANIZATIONS_ROUTE = `${CONSOLE_ROUTE}/organizations`;

export function OrganizationDetailPage({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation('console');
  const router = useRouter();
  const { date } = useDateFormatter();
  const { selectTenant, isPending: isEntering } = useSelectTenant();
  const { data, isPending, error, refetch, isRefetching } = useOrganization(organizationId);

  if (error) {
    if (getApiErrorCode(error) === 'TENANT_NOT_FOUND' || getApiErrorCode(error) === 'NOT_FOUND') {
      return <NotFound home={ORGANIZATIONS_ROUTE} />;
    }
    return (
      <Result
        status="error"
        title={t('detail.loadError')}
        extra={
          <Button type="primary" loading={isRefetching} onClick={() => void refetch()}>
            {t('detail.retry')}
          </Button>
        }
      />
    );
  }
  if (isPending) return <Skeleton active paragraph={{ rows: 6 }} />;

  const enter = async () => {
    try {
      await selectTenant(organizationId);
      router.push(DEFAULT_REDIRECT_HOME);
    } catch {
      // Surfaced by useApiError.
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Link href={ORGANIZATIONS_ROUTE} className="text-blue inline-flex items-center gap-1 text-sm">
        <ArrowLeft size={14} />
        {t('detail.backToList')}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Typography.Title level={3} className="font-heading m-0">
            {data.name}
          </Typography.Title>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Typography.Text type="secondary">{data.slug}</Typography.Text>
            <Tag>{t(`vocabulary:${data.catalogKind}.Items`)}</Tag>
            <Typography.Text type="secondary">
              {t('detail.createdAt', { date: date(data.createdAt) })}
            </Typography.Text>
          </div>
        </div>
        <Button
          type="primary"
          icon={<LogIn size={16} />}
          loading={isEntering}
          onClick={() => void enter()}
          className="w-full sm:w-auto"
        >
          {t('detail.enter')}
        </Button>
      </div>

      <Tabs
        aria-label={t('detail.tabs.label')}
        items={[
          {
            key: 'summary',
            label: t('detail.tabs.summary'),
            children: <SummaryTab organizationId={organizationId} />,
          },
          {
            key: 'features',
            label: t('detail.tabs.features'),
            children: <FeaturesTab organizationId={organizationId} />,
          },
          {
            key: 'catalog',
            label: t('detail.tabs.catalog'),
            children: <CatalogTab organizationId={organizationId} catalogKind={data.catalogKind} />,
          },
          {
            key: 'history',
            label: t('detail.tabs.history'),
            children: <HistoryTab organizationId={organizationId} />,
          },
        ]}
      />
    </div>
  );
}
