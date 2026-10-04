'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Divider } from 'antd';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { useLayoutStore } from '@/lib/stores/layout.store';
import { PipelineBoard } from '../pipeline/PipelineBoard';
import { useQuotesViewOptions } from '../../hooks/useQuotesViewOptions';
import { useQuotesViewStore, type QuotesViewTab } from '../../quotesView.store';
import { QuotesTable } from './QuotesTable';
import { QuotesToolbar } from './QuotesToolbar';
import type { Quote, QuotesPageFilters } from '../../types';

const isView = (value: string | null, views: QuotesViewTab[]): value is QuotesViewTab =>
  views.includes(value as QuotesViewTab);

export function QuotesPage() {
  const { t } = useTranslation('quotes');
  const router = useRouter();
  const searchParams = useSearchParams();
  const can = useCan();
  const setFillViewport = useLayoutStore((s) => s.setFillViewport);
  const { activeTab, setActiveTab } = useQuotesViewStore();
  const [storedFilters, setFilters] = useState<QuotesPageFilters>({});
  const [searching, setSearching] = useState(false);
  const [total, setTotal] = useState<number>();
  const { viewOptions, ready } = useQuotesViewOptions();

  const canCreate = can({ [RESOURCES.QUOTE]: [ACTIONS.CREATE] });
  const onRowClick = (quote: Quote) =>
    router.push(
      quote.isArchived ? `/admin/quotes/preview/${quote.id}` : `/admin/quotes/${quote.id}`,
    );

  const views: QuotesViewTab[] = [
    ...(can({ [RESOURCES.PIPELINE]: [ACTIONS.READ] }) ? (['pipeline'] as const) : []),
    ...(can({ [RESOURCES.QUOTE]: [ACTIONS.READ] }) ? (['table'] as const) : []),
  ];
  const paramView = searchParams.get('view');
  const view: QuotesViewTab | undefined = isView(paramView, views)
    ? paramView
    : isView(activeTab, views)
      ? activeTab
      : views[0];
  const isPipelineActive = view === 'pipeline';

  // A chip for quotes the view leaves out would match nothing, so it's dropped while unavailable.
  // Archived ones already have their own pipeline column, so that chip is table-only.
  const filters: QuotesPageFilters = {
    ...storedFilters,
    stale: viewOptions.hideStale ? undefined : storedFilters.stale,
    archived: viewOptions.includeArchived && view === 'table' ? storedFilters.archived : undefined,
  };

  const onViewChange = (next: QuotesViewTab) => {
    router.replace(`/admin/quotes?view=${next}`, { scroll: false });
    setActiveTab(next);
  };

  useEffect(() => {
    setFillViewport(isPipelineActive);
    return () => setFillViewport(false);
  }, [isPipelineActive, setFillViewport]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={`pb-4 ${
          isPipelineActive
            ? ''
            : 'md:sticky md:top-0 md:z-10 md:-mx-8 md:-mt-8 md:bg-surface md:px-8 md:pt-8'
        }`}
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
        {view && (
          <QuotesToolbar
            filters={filters}
            onFiltersChange={setFilters}
            searching={searching}
            view={view}
            views={views}
            onViewChange={onViewChange}
            viewOptions={viewOptions}
            total={total}
          />
        )}
        <Divider className="mt-3 mb-0 border-brown/30" />
      </div>

      <div className="min-h-0 flex-1">
        {view === 'pipeline' && (
          <PipelineBoard
            filters={filters}
            viewOptions={viewOptions}
            ready={ready}
            onSearchingChange={setSearching}
            onTotalChange={setTotal}
          />
        )}
        {view === 'table' && (
          <QuotesTable
            filters={filters}
            viewOptions={viewOptions}
            ready={ready}
            onRowClick={onRowClick}
            onSearchingChange={setSearching}
            onTotalChange={setTotal}
          />
        )}
      </div>
    </div>
  );
}
