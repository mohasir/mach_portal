import { paymentsIncomeQuerySchema, paymentsListQuerySchema } from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import { paymentsModule } from './payments.module';

export const paymentsRouter = router({
  list: guardedProcedure({ [RESOURCES.PAYMENT]: [ACTIONS.READ] })
    .input(paymentsListQuerySchema)
    .query(({ ctx, input }) => paymentsModule(ctx).list(input)),

  income: guardedProcedure({ [RESOURCES.PAYMENT]: [ACTIONS.READ] })
    .input(paymentsIncomeQuerySchema)
    .query(({ ctx, input }) => paymentsModule(ctx).income(input)),
});
