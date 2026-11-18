'use client';
import { Button, Card, Empty, Flex, Result, Skeleton, Statistic, Typography } from 'antd';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { CONSOLE_ROUTE } from '@/lib/auth/navigation';
import { useConsoleGlobalSummary } from '../hooks/useConsoleSummary';
import { ExpiryTag } from './ExpiryTag';

const STATS = ['organizations', 'products', 'quotes', 'events'] as const;

export function ConsoleHomePage() {
  const { t } = useTranslation('console');
  const { t: tc } = useTranslation('common');
  const { data, isPending, isError, refetch, isRefetching } = useConsoleGlobalSummary();

  const header = (
    <div className="mb-4">
      <Typography.Title level={3} className="font-heading m-0">
        {t('home.title')}
      </Typography.Title>
      <Typography.Text type="secondary">{t('home.subtitle')}</Typography.Text>
    </div>
  );

  if (isError) {
    return (
      <>
        {header}
        <Result
          status="error"
          title={t('home.loadError')}
          extra={
            <Button type="primary" loading={isRefetching} onClick={() => void refetch()}>
              {t('home.retry')}
            </Button>
          }
        />
      </>
    );
  }

  return (
    <Flex vertical gap={16}>
      {header}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((key) => (
          <Card key={key} loading={isPending}>
            <Statistic title={t(`stats.${key}`)} value={data?.[key]} />
          </Card>
        ))}
      </div>

      <Card title={t('expiring.title')}>
        {isPending ? (
          <Skeleton active paragraph={{ rows: 3 }} title={false} />
        ) : data.expiringFeatures.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('expiring.empty')} />
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {data.expiringFeatures.map((item) => (
              <li
                key={`${item.organizationId}-${item.featureKey}`}
                className="border-line flex flex-col gap-1 border-b py-3 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Typography.Text strong className="block">
                    {tc(`features.${item.featureKey}`, { defaultValue: item.featureKey })}
                  </Typography.Text>
                  <Link
                    href={`${CONSOLE_ROUTE}/organizations/${item.organizationId}`}
                    className="text-blue truncate"
                  >
                    {item.organizationName}
                  </Link>
                </div>
                <ExpiryTag expiresAt={item.expiresAt} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Flex>
  );
}
