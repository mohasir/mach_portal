import { z } from 'zod';
import {
  assignQuoteSchema,
  checkQuoteAvailabilitySchema,
  createQuoteSchema,
  quotesBoardQuerySchema,
  quotesListQuerySchema,
  resolveQuoteRateDriftSchema,
  updateQuoteSchema,
  updateQuoteStageSchema,
} from '@repo/schemas';
import { RESOURCES, ACTIONS, can, type ScopedAction } from '@repo/guards';
import { router, guardedProcedure, guardedShortTxProcedure } from '../../core/trpc/trpc';
import type { ResolvedAccess } from '../../lib/rbac/access';
import { ownerIdFor } from '../../lib/rbac/ownerScope';
import { quotesModule, quotesPdfModule } from './quotes.module';

const read = guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.READ] });
const update = guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.UPDATE] });

type AccessCtx = { user: { id: string }; access: ResolvedAccess };

// Each procedure filters by quote.read plus the quote action that gates it, the stricter winning
// (quotes.repository.ts ownerFilter): a role may read every quote yet update only its own, and an
// action granted wider than quote.read never reaches quotes the role cannot see.
function ownerScope(ctx: AccessCtx, action: ScopedAction<typeof RESOURCES.QUOTE>) {
  return ownerIdFor(
    ctx.access,
    ctx.user.id,
    [RESOURCES.QUOTE, ACTIONS.READ],
    [RESOURCES.QUOTE, action],
  );
}

// Requires quote.manage_line_pricing to set a line quantity/subtotal that does not come from a
// catalog price tier.
function canManagePricing(ctx: AccessCtx) {
  return can(ctx.access, { [RESOURCES.QUOTE]: [ACTIONS.MANAGE_LINE_PRICING] });
}

// Archived quotes require quote.view_archived: without it, asking for them is a no-op instead of
// an error, since the flag comes from a per-user view preference.
function canViewArchived(ctx: AccessCtx) {
  return can(ctx.access, { [RESOURCES.QUOTE]: [ACTIONS.VIEW_ARCHIVED] });
}

function archivedScope<T extends { includeArchived?: boolean; archived?: boolean }>(
  input: T,
  ctx: AccessCtx,
): T {
  if (canViewArchived(ctx)) return input;
  return { ...input, includeArchived: false, archived: undefined };
}

export const quotesRouter = router({
  list: read
    .input(quotesListQuerySchema)
    .query(({ ctx, input }) =>
      quotesModule(ctx).list(archivedScope(input, ctx), ownerScope(ctx, ACTIONS.READ)),
    ),
  getById: read
    .input(z.object({ id: z.uuid() }))
    .query(({ ctx, input }) =>
      quotesModule(ctx).getById(input.id, ownerScope(ctx, ACTIONS.READ), canViewArchived(ctx)),
    ),
  // Deliberately NOT ownerScope'd — advisory heads-up that should surface everyone's
  // bookings for that date/time, not just the caller's own.
  checkAvailability: read
    .input(checkQuoteAvailabilitySchema)
    .query(({ ctx, input }) => quotesModule(ctx).checkAvailability(input)),
  // Short transactions: no connection is held while the external PDF service works.
  generatePdf: guardedShortTxProcedure({ [RESOURCES.QUOTE]: [ACTIONS.READ] })
    .input(z.object({ id: z.uuid() }))
    .mutation(({ ctx, input }) =>
      quotesPdfModule(ctx).generate(input.id, ownerScope(ctx, ACTIONS.READ)),
    ),
  // Same operation as `generatePdf`, gated by quote.regenerate_pdf: forces a new PDF even when
  // the current one isn't stale.
  regeneratePdf: guardedShortTxProcedure({ [RESOURCES.QUOTE]: [ACTIONS.REGENERATE_PDF] })
    .input(z.object({ id: z.uuid() }))
    .mutation(({ ctx, input }) =>
      quotesPdfModule(ctx).generate(input.id, ownerScope(ctx, ACTIONS.REGENERATE_PDF)),
    ),
  board: guardedProcedure({ [RESOURCES.PIPELINE]: [ACTIONS.READ] })
    .input(quotesBoardQuerySchema)
    .query(({ ctx, input }) =>
      quotesModule(ctx).board(archivedScope(input, ctx), ownerScope(ctx, ACTIONS.READ)),
    ),

  create: guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.CREATE] })
    .input(createQuoteSchema)
    .mutation(({ ctx, input }) =>
      quotesModule(ctx).create(input, ctx.user.id, canManagePricing(ctx)),
    ),
  update: update
    .input(z.object({ id: z.uuid(), data: updateQuoteSchema }))
    .mutation(({ ctx, input }) =>
      quotesModule(ctx).update(
        input.id,
        input.data,
        canManagePricing(ctx),
        ownerScope(ctx, ACTIONS.UPDATE),
      ),
    ),
  // Gated to QUOTE.UPDATE: only someone who can reprice the quote is asked about new config rates.
  rateDrift: update
    .input(z.object({ id: z.uuid() }))
    .query(({ ctx, input }) =>
      quotesModule(ctx).rateDrift(input.id, ownerScope(ctx, ACTIONS.UPDATE)),
    ),
  resolveRateDrift: update
    .input(resolveQuoteRateDriftSchema)
    .mutation(({ ctx, input }) =>
      quotesModule(ctx).resolveRateDrift(input.id, input.accept, ownerScope(ctx, ACTIONS.UPDATE)),
    ),
  updateStage: update
    .input(updateQuoteStageSchema)
    .mutation(({ ctx, input }) =>
      quotesModule(ctx).updateStage(
        input.id,
        input.stageId,
        ctx.user.id,
        ownerScope(ctx, ACTIONS.UPDATE),
      ),
    ),
  approve: update
    .input(z.object({ id: z.uuid() }))
    .mutation(({ ctx, input }) =>
      quotesModule(ctx).approve(
        input.id,
        ctx.user.id,
        { name: ctx.user.name, image: ctx.user.image ?? null },
        ownerScope(ctx, ACTIONS.UPDATE),
      ),
    ),
  cancel: update
    .input(z.object({ id: z.uuid() }))
    .mutation(({ ctx, input }) =>
      quotesModule(ctx).cancel(
        input.id,
        ctx.user.id,
        { name: ctx.user.name, image: ctx.user.image ?? null },
        ownerScope(ctx, ACTIONS.UPDATE),
      ),
    ),
  canArchive: guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.DELETE] })
    .input(z.object({ id: z.uuid() }))
    .query(({ ctx, input }) =>
      quotesModule(ctx).canArchive(input.id, ownerScope(ctx, ACTIONS.DELETE)),
    ),
  archive: guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.DELETE] })
    .input(z.object({ id: z.uuid() }))
    .mutation(({ ctx, input }) =>
      quotesModule(ctx).archive(input.id, ctx.user.id, ownerScope(ctx, ACTIONS.DELETE)),
    ),

  // Not owner-scoped: reassigning hands a quote between users, so it acts on quotes the caller
  // neither created nor holds. That is why manage_assignment is not in SCOPED_ACTIONS.
  assign: guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.MANAGE_ASSIGNMENT] })
    .input(assignQuoteSchema)
    .mutation(({ ctx, input }) =>
      quotesModule(ctx).assign(input.id, input.assignedToId, ctx.user.id),
    ),
});
