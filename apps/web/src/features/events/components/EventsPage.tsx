'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs } from 'antd';
import { CalendarDays, Columns3, Table2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { useLayoutStore } from '@/lib/stores/layout.store';
import { PipelineBoard, QuotesTable, type Quote } from '@/features/quotes';
import { useEventsViewStore, type EventsViewTab } from '../events.store';
import { EventsTable } from './EventsTable';

const VALID_VIEWS: EventsViewTab[] = ['events', 'quotes', 'pipeline'];
const isValidView = (value: string | null): value is EventsViewTab =>
  VALID_VIEWS.includes(value as EventsViewTab);

export function EventsPage() {
  const { t } = useTranslation('admin');
  const { t: tq } = useTranslation('quotes');
  const router = useRouter();
  const searchParams = useSearchParams();
  const can = useCan();
  const setFillViewport = useLayoutStore((s) => s.setFillViewport);
  const { activeTab, setActiveTab } = useEventsViewStore();

  const canCreateQuote = can({ [RESOURCES.QUOTE]: [ACTIONS.CREATE] });
  const onRowClick = (quote: Quote) => router.push(`/admin/quotes/${quote.id}`);

  const paramView = searchParams.get('view');
  const activeKey: EventsViewTab = isValidView(paramView) ? paramView : activeTab;
  const isPipelineActive = activeKey === 'pipeline';

  const onChange = (key: string) => {
    router.replace(`/admin/events?view=${key}`, { scroll: false });
    setActiveTab(key as EventsViewTab);
  };

  useEffect(() => {
    setFillViewport(isPipelineActive);
    return () => setFillViewport(false);
  }, [isPipelineActive, setFillViewport]);

  const items = [
    can({ [RESOURCES.EVENT]: [ACTIONS.READ] }) && {
      key: 'events' as const,
      label: t('nav.events'),
      icon: <CalendarDays size={16} />,
      children: <EventsTable />,
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
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        activeKey={activeKey}
        onChange={onChange}
        items={items}
        className="min-h-0 flex-1"
        classNames={{ body: 'h-full', content: 'h-full' }}
        renderTabBar={(tabBarProps, DefaultTabBar) => (
          <div
            className={
              isPipelineActive
                ? undefined
                : 'sticky top-0 z-10 -mx-4 -mt-4 bg-surface px-4 pt-4 md:-mx-8 md:-mt-8 md:px-8 md:pt-8'
            }
          >
            <PageHeader
              title={t('nav.events')}
              actionLabel={canCreateQuote ? tq('index.add') : undefined}
              onAction={canCreateQuote ? () => router.push('/admin/quotes/new') : undefined}
            />
            <DefaultTabBar {...tabBarProps} />
          </div>
        )}
      />
    </div>
  );
}
