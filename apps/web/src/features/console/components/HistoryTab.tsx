'use client';
import { Button, Empty, Result, Skeleton, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { historyDetailParts } from '../helpers';
import { useOrganizationHistory } from '../hooks/useOrganizationHistory';
import type { ConsoleHistoryItem } from '../types';

function HistoryDetail({ item }: { item: ConsoleHistoryItem }) {
  const { t } = useTranslation('console');
  const { t: tc } = useTranslation('common');
  const { featureKey, path, catalogKind } = historyDetailParts(item.detail);

  if (featureKey) {
    return (
      <Typography.Text type="secondary">
        {tc(`features.${featureKey}`, { defaultValue: featureKey })}
      </Typography.Text>
    );
  }
  if (catalogKind) {
    return (
      <Typography.Text type="secondary">{t(`vocabulary:${catalogKind}.Items`)}</Typography.Text>
    );
  }
  if (path) return <Typography.Text type="secondary">{path}</Typography.Text>;
  return null;
}

export function HistoryTab({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation('console');
  const { dateTime } = useDateFormatter();
  const { data, isPending, isError, refetch, isRefetching } =
    useOrganizationHistory(organizationId);

  if (isError) {
    return (
      <Result
        status="error"
        title={t('history.loadError')}
        extra={
          <Button type="primary" loading={isRefetching} onClick={() => void refetch()}>
            {t('detail.retry')}
          </Button>
        }
      />
    );
  }
  if (isPending) return <Skeleton active paragraph={{ rows: 5 }} title={false} />;
  if (data.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('history.empty')} />;
  }

  return (
    <ol className="border-line m-0 ml-2 flex list-none flex-col gap-4 border-l p-0">
      {data.map((item) => (
        <li key={`${item.source}-${item.id}`} className="relative flex flex-col gap-0.5 pl-4">
          <span className="bg-primary absolute top-2 -left-[4.5px] size-2 rounded-full" />
          <Typography.Text strong>
            {t(`history.${item.label}`, { defaultValue: item.label })}
          </Typography.Text>
          <HistoryDetail item={item} />
          <Typography.Text type="secondary" className="text-sm">
            {dateTime(item.createdAt)} · {t('history.by', { actor: item.actor })}
          </Typography.Text>
        </li>
      ))}
    </ol>
  );
}
