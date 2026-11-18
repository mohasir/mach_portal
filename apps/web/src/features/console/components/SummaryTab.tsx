'use client';
import { Button, Card, Empty, Result, Skeleton, Statistic } from 'antd';
import { useTranslation } from 'react-i18next';
import { useOrganizationSummary } from '../hooks/useOrganizationSummary';

const STATS = ['products', 'clients', 'events'] as const;

export function SummaryTab({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation('console');
  const { data, isPending, isError, refetch, isRefetching } =
    useOrganizationSummary(organizationId);

  if (isError) {
    return (
      <Result
        status="error"
        title={t('summary.loadError')}
        extra={
          <Button type="primary" loading={isRefetching} onClick={() => void refetch()}>
            {t('detail.retry')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STATS.map((key) => (
          <Card key={key} loading={isPending}>
            <Statistic title={t(`summary.${key}`)} value={data?.[key]} />
          </Card>
        ))}
      </div>

      <Card title={t('summary.quotesByStage')}>
        {isPending ? (
          <Skeleton active paragraph={{ rows: 3 }} title={false} />
        ) : data.quotesByStage.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('summary.quotesEmpty')} />
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {data.quotesByStage.map((stage) => (
              <li
                key={stage.stageId}
                className="border-line flex items-center justify-between gap-3 border-b py-2 first:pt-0 last:border-b-0 last:pb-0"
              >
                <span className="min-w-0 truncate">{stage.label}</span>
                <span className="font-medium">{stage.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
