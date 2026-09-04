import { z } from 'zod';
import {
  assignQuoteSchema,
  checkQuoteAvailabilitySchema,
  createQuoteSchema,
  quotesBoardQuerySchema,
  quotesListQuerySchema,
  updateQuoteSchema,
  updateQuoteStageSchema,
} from '@repo/schemas';
import { RESOURCES, ACTIONS, hasPermission, resolveResourceScope } from '@repo/guards';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import { db } from '../../db';
import { ConfigRepository } from '../config/config.repository';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { ProductsRepository } from '../products/products.repository';
import { TemplatesRepository } from '../templates/templates.repository';
import { QuotesRepository } from './quotes.repository';
import { QuotesService } from './quotes.service';

const service = new QuotesService(
  new QuotesRepository(db),
  new ConfigRepository(db),
  new ProductsRepository(db),
  new TemplatesRepository(db),
  new NotificationsRepository(db),
);

const read = guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.READ] });
const update = guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.UPDATE] });

// scope 'own' (resolveResourceScope) → solo ve/edita las cotizaciones que creó o
// tiene asignadas (quotes.repository.ts ownerFilter); scope 'all' → sin restricción.
function ownerScope(ctx: { user: { id: string; role?: string | null } }) {
  return resolveResourceScope(ctx.user.role, RESOURCES.QUOTE) === 'own' ? ctx.user.id : undefined;
}

// Puede fijar un numPersons/subtotal de línea que no venga de una tarifa del catálogo
// (solo admin/superadmin — ver rolesPermissions.matrix.ts QUOTE_FULL).
function canManagePricing(ctx: { user: { role?: string | null } }) {
  return hasPermission(ctx.user.role, { [RESOURCES.QUOTE]: [ACTIONS.MANAGE_LINE_PRICING] });
}

export const quotesRouter = router({
  list: read
    .input(quotesListQuerySchema)
    .query(({ input, ctx }) => service.list(input, ownerScope(ctx))),
  getById: read
    .input(z.object({ id: z.uuid() }))
    .query(({ input, ctx }) => service.getById(input.id, ownerScope(ctx))),
  // Deliberately NOT ownerScope'd — advisory heads-up that should surface everyone's
  // bookings for that date/time, not just the caller's own.
  checkAvailability: read
    .input(checkQuoteAvailabilitySchema)
    .query(({ input }) => service.checkAvailability(input)),
  generatePdf: read
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input, ctx }) => service.generatePdf(input.id, ownerScope(ctx))),
  // Same operation as `generatePdf`, gated to a stricter permission — forces a new PDF
  // even when the current one isn't stale (superadmin only, see rolesPermissions.matrix.ts).
  regeneratePdf: guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.REGENERATE_PDF] })
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input, ctx }) => service.generatePdf(input.id, ownerScope(ctx))),
  board: guardedProcedure({ [RESOURCES.PIPELINE]: [ACTIONS.READ] })
    .input(quotesBoardQuerySchema)
    .query(({ input, ctx }) => service.board(input, ownerScope(ctx))),

  create: guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.CREATE] })
    .input(createQuoteSchema)
    .mutation(({ input, ctx }) => service.create(input, ctx.user.id, canManagePricing(ctx))),
  update: update
    .input(z.object({ id: z.uuid(), data: updateQuoteSchema }))
    .mutation(({ input, ctx }) =>
      service.update(input.id, input.data, canManagePricing(ctx), ownerScope(ctx)),
    ),
  updateStage: update
    .input(updateQuoteStageSchema)
    .mutation(({ input, ctx }) =>
      service.updateStage(input.id, input.stageId, ctx.user.id, ownerScope(ctx)),
    ),
  approve: update
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input, ctx }) =>
      service.approve(
        input.id,
        ctx.user.id,
        { name: ctx.user.name, image: ctx.user.image ?? null },
        ownerScope(ctx),
      ),
    ),
  cancel: update
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input, ctx }) =>
      service.cancel(
        input.id,
        ctx.user.id,
        { name: ctx.user.name, image: ctx.user.image ?? null },
        ownerScope(ctx),
      ),
    ),
  archive: guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.DELETE] })
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input, ctx }) => service.archive(input.id, ownerScope(ctx))),

  assign: guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.MANAGE_ASSIGNMENT] })
    .input(assignQuoteSchema)
    .mutation(({ input, ctx }) => service.assign(input.id, input.assignedToId, ctx.user.id)),
});
