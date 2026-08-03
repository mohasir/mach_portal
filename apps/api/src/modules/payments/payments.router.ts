import { paymentsIncomeQuerySchema, paymentsListQuerySchema } from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import { db } from '../../db';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';

const service = new PaymentsService(new PaymentsRepository(db));

export const paymentsRouter = router({
  list: guardedProcedure({ [RESOURCES.PAYMENT]: [ACTIONS.READ] })
    .input(paymentsListQuerySchema)
    .query(({ input }) => service.list(input)),

  income: guardedProcedure({ [RESOURCES.PAYMENT]: [ACTIONS.READ] })
    .input(paymentsIncomeQuerySchema)
    .query(({ input }) => service.income(input)),
});
