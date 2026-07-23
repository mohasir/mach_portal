'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs } from 'antd';
import { Columns3, Plus, Table2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { useLayoutStore } from '@/lib/stores/layout.store';
import { PipelineBoard } from '../pipeline/PipelineBoard';
import { useQuotesViewStore, type QuotesViewTab } from '../../quotesView.store';
import { QuotesTable } from './QuotesTable';
import type { Quote } from '../../types';

const VALID_VIEWS: QuotesViewTab[] = ['pipeline', 'table'];
const isValidView = (value: string | null): value is QuotesViewTab =>
  VALID_VIEWS.includes(value as QuotesViewTab);

export function QuotesPage() {
  const { t } = useTranslation('quotes');
  const router = useRouter();
  const searchParams = useSearchParams();
  const can = useCan();
  const setFillViewport = useLayoutStore((s) => s.setFillViewport);
  const { activeTab, setActiveTab } = useQuotesViewStore();

  const canCreate = can({ [RESOURCES.QUOTE]: [ACTIONS.CREATE] });
  const onRowClick = (quote: Quote) => router.push(`/admin/quotes/${quote.id}`);

  const paramView = searchParams.get('view');
  const activeKey: QuotesViewTab = isValidView(paramView) ? paramView : activeTab;
  const isPipelineActive = activeKey === 'pipeline';

  const onChange = (key: string) => {
    router.replace(`/admin/quotes?view=${key}`, { scroll: false });
    setActiveTab(key as QuotesViewTab);
  };

  useEffect(() => {
    setFillViewport(isPipelineActive);
    return () => setFillViewport(false);
  }, [isPipelineActive, setFillViewport]);

  const items = [
    can({ [RESOURCES.PIPELINE]: [ACTIONS.READ] }) && {
      key: 'pipeline' as const,
      label: t('pipeline.title'),
      icon: <Columns3 size={16} />,
      children: <PipelineBoard />,
    },
    can({ [RESOURCES.QUOTE]: [ACTIONS.READ] }) && {
      key: 'table' as const,
      label: t('title'),
      icon: <Table2 size={16} />,
      children: <QuotesTable onRowClick={onRowClick} />,
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
                : 'md:sticky md:top-0 md:z-10 md:-mx-8 md:-mt-8 md:bg-surface md:px-8 md:pt-8'
            }
          >
            <PageHeader
              title={t('title')}
              actionLabel={canCreate ? t('index.add') : undefined}
              onAction={canCreate ? () => router.push('/admin/quotes/new') : undefined}
              mobileAction={
                canCreate
                  ? {
                      icon: Plus,
                      onClick: () => router.push('/admin/quotes/new'),
                      ariaLabel: t('index.add'),
                    }
                  : undefined
              }
            />
            <DefaultTabBar {...tabBarProps} />
          </div>
        )}
      />
    </div>
  );
}
