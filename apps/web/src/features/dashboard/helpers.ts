export type DashboardMetricKey = 'eventsCount' | 'revenue' | 'quotesCount' | 'closeRate';

export interface ActiveModules {
  quotes: boolean;
  events: boolean;
}

// Revenue is the sum of event payments, so it follows `events`; top products are counted from
// quote lines, so they follow `quotes`.
export function visibleDashboardSections({ quotes, events }: ActiveModules) {
  const metrics: DashboardMetricKey[] = [
    ...(events ? (['eventsCount', 'revenue'] as const) : []),
    ...(quotes ? (['quotesCount', 'closeRate'] as const) : []),
  ];
  return {
    metrics,
    upcomingEvents: events,
    quotesByMonth: quotes,
    topProducts: quotes,
  };
}

// Column spans (of 24) for a metric tile so a reduced row still fills its width: two per row on
// mobile (a lone odd tile spans the full row), an even split on larger screens.
export function metricColSpan(count: number, index: number): { xs: number; md: number } {
  const loneOdd = count % 2 === 1 && index === count - 1;
  return { xs: loneOdd ? 24 : 12, md: Math.floor(24 / count) };
}
