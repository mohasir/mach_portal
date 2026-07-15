'use client';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { QuotesTable } from './QuotesTable';
import type { Quote } from '../../types';

export function QuotesPage() {
  const { t } = useTranslation('quotes');
  const router = useRouter();
  const can = useCan();
  const canCreate = can({ [RESOURCES.QUOTE]: [ACTIONS.CREATE] });

  const onRowClick = (quote: Quote) => router.push(`/admin/quotes/${quote.id}`);

  return (
    <div>
      <PageHeader
        title={t('title')}
        actionLabel={canCreate ? t('index.add') : undefined}
        onAction={canCreate ? () => router.push('/admin/quotes/new') : undefined}
      />
      <QuotesTable onRowClick={onRowClick} />
    </div>
  );
}
