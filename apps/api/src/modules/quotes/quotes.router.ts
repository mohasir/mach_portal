import { z } from 'zod';
import {
  createQuoteSchema,
  quotesBoardQuerySchema,
  quotesListQuerySchema,
  updateQuoteSchema,
  updateQuoteStageSchema,
} from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import { db } from '../../db';
import { ConfigRepository } from '../config/config.repository';
import { ProductsRepository } from '../products/products.repository';
import { TemplatesRepository } from '../templates/templates.repository';
import { QuotesRepository } from './quotes.repository';
import { QuotesService } from './quotes.service';

const service = new QuotesService(
  new QuotesRepository(db),
  new ConfigRepository(db),
  new ProductsRepository(db),
  new TemplatesRepository(db),
);

const read = guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.READ] });
const update = guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.UPDATE] });

export const quotesRouter = router({
  list: read.input(quotesListQuerySchema).query(({ input }) => service.list(input)),
  getById: read.input(z.object({ id: z.uuid() })).query(({ input }) => service.getById(input.id)),
  generatePdf: read
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input }) => service.generatePdf(input.id)),
  board: guardedProcedure({ [RESOURCES.PIPELINE]: [ACTIONS.READ] })
    .input(quotesBoardQuerySchema)
    .query(({ input }) => service.board(input)),

  create: guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.CREATE] })
    .input(createQuoteSchema)
    .mutation(({ input, ctx }) => service.create(input, ctx.user.id)),
  update: update
    .input(z.object({ id: z.uuid(), data: updateQuoteSchema }))
    .mutation(({ input }) => service.update(input.id, input.data)),
  updateStage: update
    .input(updateQuoteStageSchema)
    .mutation(({ input, ctx }) => service.updateStage(input.id, input.stageId, ctx.user.id)),
  approve: update
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input, ctx }) => service.approve(input.id, ctx.user.id)),
  cancel: update
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input, ctx }) => service.cancel(input.id, ctx.user.id)),
  archive: guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.DELETE] })
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input }) => service.archive(input.id)),
});
