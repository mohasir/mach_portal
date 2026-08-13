'use client';
import { useQuery } from '@tanstack/react-query';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type {
  DashboardQuotesByMonthQuery,
  DashboardSummaryQuery,
  DashboardTopProductsQuery,
} from '@repo/schemas';
import { useCan } from '@/lib/auth/useCan';
import { useTRPC } from '@/lib/trpc/client';

export function useDashboardSummary(query: DashboardSummaryQuery) {
  const trpc = useTRPC();
  const can = useCan();
  return useQuery(
    trpc.dashboard.summary.queryOptions(query, {
      enabled: can({ [RESOURCES.DASHBOARD]: [ACTIONS.VIEW_SUMMARY] }),
    }),
  );
}

export function useDashboardQuotesByMonth(query: DashboardQuotesByMonthQuery) {
  const trpc = useTRPC();
  const can = useCan();
  return useQuery(
    trpc.dashboard.quotesByMonth.queryOptions(query, {
      enabled: can({ [RESOURCES.DASHBOARD]: [ACTIONS.VIEW_QUOTES_CHART] }),
    }),
  );
}

export function useDashboardTopProducts(query: DashboardTopProductsQuery) {
  const trpc = useTRPC();
  const can = useCan();
  return useQuery(
    trpc.dashboard.topProducts.queryOptions(query, {
      enabled: can({ [RESOURCES.DASHBOARD]: [ACTIONS.VIEW_TOP_PRODUCTS] }),
    }),
  );
}
