import { z } from 'zod';
import {
  createQuoteSchema,
  quotesBoardQuerySchema,
  quotesListQuerySchema,
  updateQuoteSchema,
  updateQuoteStageSchema,
} from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../trpc/trpc';
import { db } from '../../db';
import { ConfigRepository } from '../config/config.repository';
import { QuotesRepository } from './quotes.repository';
import { QuotesService } from './quotes.service';

const service = new QuotesService(new QuotesRepository(db), new ConfigRepository(db));

const read = guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.READ] });
const update = guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.UPDATE] });

export const quotesRouter = router({
  list: read.input(quotesListQuerySchema).query(({ input }) => service.list(input)),
  getById: read.input(z.object({ id: z.uuid() })).query(({ input }) => service.getById(input.id)),
  board: guardedProcedure({ [RESOURCES.PIPELINE]: [ACTIONS.READ] })
    .input(quotesBoardQuerySchema)
    .query(({ input }) => service.board(input)),

  create: guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.CREATE] })
    .input(createQuoteSchema)
    .mutation(({ input }) => service.create(input)),
  update: update
    .input(z.object({ id: z.uuid(), data: updateQuoteSchema }))
    .mutation(({ input }) => service.update(input.id, input.data)),
  updateStage: update
    .input(updateQuoteStageSchema)
    .mutation(({ input }) => service.updateStage(input.id, input.stage)),
  approve: update
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input }) => service.approve(input.id)),
  cancel: update
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input }) => service.cancel(input.id)),
});
