import { paymentsIncomeQuerySchema, paymentsListQuerySchema } from '@repo/schemas';
import { RESOURCES, ACTIONS, type ScopedAction } from '@repo/guards';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import type { ResolvedAccess } from '../../lib/rbac/access';
import { ownerIdFor } from '../../lib/rbac/ownerScope';
import { paymentsModule } from './payments.module';

type AccessCtx = { user: { id: string }; access: ResolvedAccess };

// A payment belongs to whoever owns its event's quote (created by or assigned to them).
function ownerScope(ctx: AccessCtx, action: ScopedAction<typeof RESOURCES.PAYMENT>) {
  return ownerIdFor(ctx.access, ctx.user.id, [RESOURCES.PAYMENT, action]);
}

export const paymentsRouter = router({
  list: guardedProcedure({ [RESOURCES.PAYMENT]: [ACTIONS.READ] })
    .input(paymentsListQuerySchema)
    .query(({ ctx, input }) => paymentsModule(ctx).list(input, ownerScope(ctx, ACTIONS.READ))),

  income: guardedProcedure({ [RESOURCES.PAYMENT]: [ACTIONS.READ] })
    .input(paymentsIncomeQuerySchema)
    .query(({ ctx, input }) => paymentsModule(ctx).income(input, ownerScope(ctx, ACTIONS.READ))),
});
