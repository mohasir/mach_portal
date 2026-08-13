import type { RouterOutputs } from '@/lib/trpc/types';

export type DashboardSummary = RouterOutputs['dashboard']['summary'];
export type DashboardQuotesByMonth = RouterOutputs['dashboard']['quotesByMonth'];
export type DashboardTopProducts = RouterOutputs['dashboard']['topProducts'];
