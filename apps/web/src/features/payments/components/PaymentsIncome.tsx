'use client';
import { useState } from 'react';
import { Select } from 'antd';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import type { PaymentsIncomeGroupBy } from '@repo/schemas';
import { DataTable } from '@/components/shared/DataTable';
import type { Locale as AppLocale } from '@/lib/i18n/config';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { useLocaleStore } from '@/lib/stores/locale.store';
import { usePaymentsIncome } from '../hooks/usePayments';
import type { PaymentIncomeItem } from '../types';

const GROUP_BY_OPTIONS: PaymentsIncomeGroupBy[] = ['week', 'month', 'year'];

export function PaymentsIncome() {
  const { t } = useTranslation('payments');
  const { money } = useMoneyFormatter();
  const locale = useLocaleStore((s) => s.locale) as AppLocale;
  const [groupBy, setGroupBy] = useState<PaymentsIncomeGroupBy>('month');

  const { data, isLoading } = usePaymentsIncome({ groupBy });

  const formatPeriod = (period: string) => {
    const periodStart = dayjs(period).locale(locale);
    if (groupBy === 'year') return periodStart.format('YYYY');
    if (groupBy === 'month') return periodStart.format('MMMM YYYY');
    return t('income.weekOf', { date: periodStart.format('D MMM YYYY') });
  };

  const columns: TableColumnsType<PaymentIncomeItem> = [
    {
      title: t('income.columns.period'),
      dataIndex: 'period',
      key: 'period',
      render: (value: PaymentIncomeItem['period']) => formatPeriod(value),
    },
    {
      title: t('income.columns.total'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      render: (value: PaymentIncomeItem['totalAmount']) => money(value),
    },
    {
      title: t('income.columns.count'),
      dataIndex: 'count',
      key: 'count',
      align: 'right',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Select<PaymentsIncomeGroupBy>
        className="w-full sm:w-48"
        value={groupBy}
        onChange={setGroupBy}
        options={GROUP_BY_OPTIONS.map((value) => ({ value, label: t(`income.groupBy.${value}`) }))}
      />
      <DataTable<PaymentIncomeItem>
        rowKey="period"
        columns={columns}
        dataSource={data?.items}
        loading={isLoading}
        emptyText={t('income.empty')}
      />
    </div>
  );
}
