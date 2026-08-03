'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import { PaymentsIncome } from './PaymentsIncome';
import { PaymentsTable } from './PaymentsTable';

type PaymentsView = 'list' | 'income';
const VALID_VIEWS: PaymentsView[] = ['list', 'income'];
const isValidView = (value: string | null): value is PaymentsView =>
  VALID_VIEWS.includes(value as PaymentsView);

export function PaymentsPage() {
  const { t } = useTranslation('payments');
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramView = searchParams.get('view');
  const [view, setView] = useState<PaymentsView>(isValidView(paramView) ? paramView : 'list');

  const onChange = (value: PaymentsView) => {
    setView(value);
    router.replace(`/admin/payments?view=${value}`, { scroll: false });
  };

  return (
    <div>
      <PageHeader title={t('title')} />
      <Segmented
        block
        className="mb-4"
        value={view}
        onChange={(value) => onChange(value as PaymentsView)}
        options={[
          { value: 'list', label: t('views.list') },
          { value: 'income', label: t('views.income') },
        ]}
      />
      {view === 'list' ? <PaymentsTable /> : <PaymentsIncome />}
    </div>
  );
}
