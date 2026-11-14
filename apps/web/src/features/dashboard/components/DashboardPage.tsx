'use client';
import type { ReactNode } from 'react';
import { Col, Row } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { UpcomingEventsCard } from '@/features/events';
import { Can } from '@/lib/auth/Can';
import { useFeature } from '@/lib/auth/useFeature';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import {
  useDashboardQuotesByMonth,
  useDashboardSummary,
  useDashboardTopProducts,
} from '../hooks/useDashboard';
import { metricColSpan, visibleDashboardSections, type DashboardMetricKey } from '../helpers';
import { MetricCard } from './MetricCard';
import { QuotesByMonthChart } from './QuotesByMonthChart';
import { TopProductsList } from './TopProductsList';

// Fixed to the current month/year — read-only summary, no interactivity here.
// Picking an arbitrary period belongs to a future dedicated reports screen.
const now = dayjs();
const MONTH = now.month() + 1;
const YEAR = now.year();

export function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { money } = useMoneyFormatter();
  const show = visibleDashboardSections({
    quotes: useFeature('quotes'),
    events: useFeature('events'),
  });

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary({
    month: MONTH,
    year: YEAR,
  });
  const { data: quotesByMonth, isLoading: quotesByMonthLoading } = useDashboardQuotesByMonth({
    year: YEAR,
  });
  const { data: topProducts, isLoading: topProductsLoading } = useDashboardTopProducts({
    month: MONTH,
    year: YEAR,
    limit: 5,
  });

  const metricTiles: Record<DashboardMetricKey, { label: string; value: ReactNode; bg: string }> = {
    eventsCount: {
      label: t('stats.eventsCount'),
      value: summary?.eventsCount ?? 0,
      bg: 'bg-mist',
    },
    revenue: { label: t('stats.revenue'), value: money(summary?.revenue ?? 0), bg: 'bg-sand' },
    quotesCount: {
      label: t('stats.quotesCount'),
      value: summary?.quotesCount ?? 0,
      bg: 'bg-blue/15',
    },
    closeRate: {
      label: t('stats.closeRate'),
      value: `${Math.round((summary?.closeRate ?? 0) * 100)}%`,
      bg: 'bg-blue-light/30',
    },
  };

  return (
    <div className="flex flex-col gap-4">
      {show.upcomingEvents && (
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <UpcomingEventsCard />
          </Col>
        </Row>
      )}

      {show.metrics.length > 0 && (
        <Can allowed={{ [RESOURCES.DASHBOARD]: [ACTIONS.VIEW_SUMMARY] }}>
          <Row gutter={[16, 16]}>
            {show.metrics.map((key, index) => (
              <Col key={key} {...metricColSpan(show.metrics.length, index)}>
                <MetricCard {...metricTiles[key]} loading={summaryLoading} />
              </Col>
            ))}
          </Row>
        </Can>
      )}

      {show.quotesByMonth && (
        <Can allowed={{ [RESOURCES.DASHBOARD]: [ACTIONS.VIEW_QUOTES_CHART] }}>
          <QuotesByMonthChart year={YEAR} data={quotesByMonth} isLoading={quotesByMonthLoading} />
        </Can>
      )}

      {show.topProducts && (
        <Can allowed={{ [RESOURCES.DASHBOARD]: [ACTIONS.VIEW_TOP_PRODUCTS] }}>
          <TopProductsList
            data={topProducts}
            isLoading={topProductsLoading}
            month={MONTH}
            year={YEAR}
          />
        </Can>
      )}
    </div>
  );
}
