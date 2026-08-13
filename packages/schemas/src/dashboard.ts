import { z } from 'zod';

export const dashboardSummaryQuerySchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
});
export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;

export const dashboardQuotesByMonthQuerySchema = z.object({
  year: z.number().int(),
});
export type DashboardQuotesByMonthQuery = z.infer<typeof dashboardQuotesByMonthQuerySchema>;

export const dashboardTopProductsQuerySchema = dashboardSummaryQuerySchema.extend({
  limit: z.number().int().min(1).max(20).default(5),
});
export type DashboardTopProductsQuery = z.infer<typeof dashboardTopProductsQuerySchema>;
