'use client';
import type { TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { PAYMENT_METHOD_ICONS } from '../helpers';
import type { Payment } from '../types';

export function usePaymentsColumns(): TableColumnsType<Payment> {
  const { t } = useTranslation('payments');
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();

  return [
    {
      title: t('columns.paidAt'),
      dataIndex: 'paidAt',
      key: 'paidAt',
      render: (value: Payment['paidAt']) => date(value),
    },
    { title: t('columns.client'), dataIndex: 'clientName', key: 'clientName' },
    {
      title: t('columns.eventType'),
      dataIndex: 'eventTypeName',
      key: 'eventTypeName',
      responsive: ['md'],
      render: (value: Payment['eventTypeName']) => value ?? '—',
    },
    {
      title: t('columns.eventDate'),
      dataIndex: 'eventDate',
      key: 'eventDate',
      responsive: ['lg'],
      render: (value: Payment['eventDate']) => (value ? date(value) : '—'),
    },
    {
      title: t('columns.method'),
      dataIndex: 'method',
      key: 'method',
      render: (method: Payment['method']) => {
        const MethodIcon = PAYMENT_METHOD_ICONS[method];
        return (
          <span className="flex items-center gap-1.5">
            <MethodIcon size={14} className="shrink-0" />
            {t(`paymentMethods.${method}`)}
          </span>
        );
      },
    },
    {
      title: t('columns.amount'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (value: Payment['amount']) => money(value),
    },
    {
      title: t('columns.reference'),
      dataIndex: 'reference',
      key: 'reference',
      responsive: ['lg'],
      render: (value: Payment['reference']) => value ?? '—',
    },
    {
      title: t('columns.registeredBy'),
      dataIndex: 'createdByName',
      key: 'createdByName',
      responsive: ['lg'],
      render: (value: Payment['createdByName']) => value ?? '—',
    },
  ];
}
