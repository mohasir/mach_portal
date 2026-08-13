import { RESOURCES, ACTIONS } from '@repo/guards';
import {
  dashboardQuotesByMonthQuerySchema,
  dashboardSummaryQuerySchema,
  dashboardTopProductsQuerySchema,
} from '@repo/schemas';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import { db } from '../../db';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

const service = new DashboardService(new DashboardRepository(db));

export const dashboardRouter = router({
  summary: guardedProcedure({ [RESOURCES.DASHBOARD]: [ACTIONS.VIEW_SUMMARY] })
    .input(dashboardSummaryQuerySchema)
    .query(({ input }) => service.summary(input)),

  quotesByMonth: guardedProcedure({ [RESOURCES.DASHBOARD]: [ACTIONS.VIEW_QUOTES_CHART] })
    .input(dashboardQuotesByMonthQuerySchema)
    .query(({ input }) => service.quotesByMonth(input)),

  topProducts: guardedProcedure({ [RESOURCES.DASHBOARD]: [ACTIONS.VIEW_TOP_PRODUCTS] })
    .input(dashboardTopProductsQuerySchema)
    .query(({ input }) => service.topProducts(input)),
});
