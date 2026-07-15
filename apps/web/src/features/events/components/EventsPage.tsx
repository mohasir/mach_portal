'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Empty, Tabs, Typography } from 'antd';
import { Calendar, Columns3, Table2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { PipelineBoard, QuotesTable, type Quote } from '@/features/quotes';

type ViewKey = 'calendar' | 'quotes' | 'pipeline';
const DEFAULT_VIEW: ViewKey = 'calendar';

export function EventsPage() {
  const { t } = useTranslation('admin');
  const { t: tq } = useTranslation('quotes');
  const router = useRouter();
  const searchParams = useSearchParams();
  const can = useCan();

  const canCreateQuote = can({ [RESOURCES.QUOTE]: [ACTIONS.CREATE] });
  const onRowClick = (quote: Quote) => router.push(`/admin/quotes/${quote.id}`);

  const paramView = searchParams.get('view');
  const activeKey: ViewKey =
    paramView === 'quotes' || paramView === 'pipeline' ? paramView : DEFAULT_VIEW;

  const onChange = (key: string) => {
    router.replace(`/admin/events?view=${key}`, { scroll: false });
  };

  const items = [
    can({ [RESOURCES.EVENT]: [ACTIONS.READ] }) && {
      key: 'calendar' as const,
      label: t('nav.calendarTab'),
      icon: <Calendar size={16} />,
      children: (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} className="mt-16">
          <Typography.Text className="text-muted">{t('placeholder.comingSoon')}</Typography.Text>
        </Empty>
      ),
    },
    can({ [RESOURCES.QUOTE]: [ACTIONS.READ] }) && {
      key: 'quotes' as const,
      label: tq('title'),
      icon: <Table2 size={16} />,
      children: <QuotesTable onRowClick={onRowClick} />,
    },
    can({ [RESOURCES.PIPELINE]: [ACTIONS.READ] }) && {
      key: 'pipeline' as const,
      label: tq('pipeline.title'),
      icon: <Columns3 size={16} />,
      children: <PipelineBoard />,
    },
  ].filter((item) => !!item);

  return (
    <div>
      <PageHeader
        title={t('nav.events')}
        actionLabel={canCreateQuote ? tq('index.add') : undefined}
        onAction={canCreateQuote ? () => router.push('/admin/quotes/new') : undefined}
      />
      <Tabs activeKey={activeKey} onChange={onChange} items={items} />
    </div>
  );
}
