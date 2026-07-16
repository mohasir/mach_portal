'use client';
import { Tag, type TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import type { QuoteStageId } from '@repo/schemas';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { useQuoteStages } from '@/features/settings';
import { useQuoteRowActions } from '../../hooks/useQuoteRowActions';
import type { Quote } from '../../types';

export function useQuotesColumns(): TableColumnsType<Quote> {
  const { t } = useTranslation('quotes');
  const { t: tc } = useTranslation('common');
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();
  const { stageMap } = useQuoteStages();
  const rowActions = useQuoteRowActions();

  return [
    { title: t('columns.number'), dataIndex: 'number', key: 'number' },
    { title: t('columns.client'), dataIndex: 'clientName', key: 'clientName' },
    {
      title: t('columns.eventDate'),
      dataIndex: 'eventDate',
      key: 'eventDate',
      responsive: ['md'],
      render: (value: Quote['eventDate']) => (value ? date(value) : '—'),
    },
    {
      title: t('columns.stage'),
      dataIndex: 'stageId',
      key: 'stageId',
      render: (stageId: Quote['stageId']) => {
        const stage = stageMap.get(stageId as QuoteStageId);
        return <Tag color={stage?.color}>{stage?.label}</Tag>;
      },
    },
    {
      title: t('columns.total'),
      dataIndex: 'total',
      key: 'total',
      align: 'right',
      render: (value: Quote['total']) => money(value),
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'right',
      render: (_, row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DataTableRowActions actions={rowActions(row)} label={tc('table.actions')} />
        </div>
      ),
    },
  ];
}
