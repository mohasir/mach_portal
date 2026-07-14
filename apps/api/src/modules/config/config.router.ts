import { updateConfigSchema } from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../trpc/trpc';
import { db } from '../../db';
import { ConfigRepository } from './config.repository';
import { ConfigService } from './config.service';

const service = new ConfigService(new ConfigRepository(db));

export const configRouter = router({
  get: guardedProcedure({ [RESOURCES.CONFIG]: [ACTIONS.READ] }).query(() => service.get()),
  update: guardedProcedure({ [RESOURCES.CONFIG]: [ACTIONS.UPDATE] })
    .input(updateConfigSchema)
    .mutation(({ input }) => service.update(input)),
});
