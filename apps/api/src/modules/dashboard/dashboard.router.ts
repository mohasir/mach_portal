import { RESOURCES, ACTIONS } from '@repo/guards';
import {
  dashboardQuotesByMonthQuerySchema,
  dashboardSummaryQuerySchema,
  dashboardTopProductsQuerySchema,
} from '@repo/schemas';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import { dashboardModule } from './dashboard.module';

export const dashboardRouter = router({
  summary: guardedProcedure({ [RESOURCES.DASHBOARD]: [ACTIONS.VIEW_SUMMARY] })
    .input(dashboardSummaryQuerySchema)
    .query(({ ctx, input }) => dashboardModule(ctx).summary(input)),

  quotesByMonth: guardedProcedure({ [RESOURCES.DASHBOARD]: [ACTIONS.VIEW_QUOTES_CHART] })
    .input(dashboardQuotesByMonthQuerySchema)
    .query(({ ctx, input }) => dashboardModule(ctx).quotesByMonth(input)),

  topProducts: guardedProcedure({ [RESOURCES.DASHBOARD]: [ACTIONS.VIEW_TOP_PRODUCTS] })
    .input(dashboardTopProductsQuerySchema)
    .query(({ ctx, input }) => dashboardModule(ctx).topProducts(input)),
});
