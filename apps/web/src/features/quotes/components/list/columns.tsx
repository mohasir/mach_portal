'use client';
import { Tag, type TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { QUOTE_STAGE_COLORS } from '../../helpers';
import type { Quote } from '../../types';

export function useQuotesColumns(): TableColumnsType<Quote> {
  const { t } = useTranslation('quotes');
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();

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
      dataIndex: 'stage',
      key: 'stage',
      render: (stage: Quote['stage']) => (
        <Tag color={QUOTE_STAGE_COLORS[stage]}>{t(`stage.${stage}`)}</Tag>
      ),
    },
    {
      title: t('columns.total'),
      dataIndex: 'total',
      key: 'total',
      align: 'right',
      render: (value: Quote['total']) => money(value),
    },
  ];
}
