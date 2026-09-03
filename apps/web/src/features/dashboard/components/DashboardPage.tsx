'use client';
import { Col, Row } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { UpcomingEventsCard } from '@/features/events';
import { Can } from '@/lib/auth/Can';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import {
  useDashboardQuotesByMonth,
  useDashboardSummary,
  useDashboardTopProducts,
} from '../hooks/useDashboard';
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

  return (
    <div className="flex flex-col gap-4">
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <UpcomingEventsCard />
        </Col>
      </Row>

      <Can allowed={{ [RESOURCES.DASHBOARD]: [ACTIONS.VIEW_SUMMARY] }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <MetricCard
              label={t('stats.eventsCount')}
              value={summary?.eventsCount ?? 0}
              bg="bg-olive-faint"
              loading={summaryLoading}
            />
          </Col>
          <Col xs={12} md={6}>
            <MetricCard
              label={t('stats.revenue')}
              value={money(summary?.revenue ?? 0)}
              bg="bg-ivory"
              loading={summaryLoading}
            />
          </Col>
          <Col xs={12} md={6}>
            <MetricCard
              label={t('stats.quotesCount')}
              value={summary?.quotesCount ?? 0}
              bg="bg-salmon/20"
              loading={summaryLoading}
            />
          </Col>
          <Col xs={12} md={6}>
            <MetricCard
              label={t('stats.closeRate')}
              value={`${Math.round((summary?.closeRate ?? 0) * 100)}%`}
              bg="bg-mustard/20"
              loading={summaryLoading}
            />
          </Col>
        </Row>
      </Can>

      <Can allowed={{ [RESOURCES.DASHBOARD]: [ACTIONS.VIEW_QUOTES_CHART] }}>
        <QuotesByMonthChart year={YEAR} data={quotesByMonth} isLoading={quotesByMonthLoading} />
      </Can>

      <Can allowed={{ [RESOURCES.DASHBOARD]: [ACTIONS.VIEW_TOP_PRODUCTS] }}>
        <TopProductsList
          data={topProducts}
          isLoading={topProductsLoading}
          month={MONTH}
          year={YEAR}
        />
      </Can>
    </div>
  );
}
