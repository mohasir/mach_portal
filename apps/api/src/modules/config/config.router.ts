import {
  updateCatalogPreferencesSchema,
  updateQuoteDefaultsSchema,
  updateQuoteStagesSchema,
  updateTaxRatesSchema,
} from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure, protectedProcedure } from '../../core/trpc/trpc';
import { db } from '../../db';
import { ConfigRepository } from './config.repository';
import { ConfigService } from './config.service';

const service = new ConfigService(new ConfigRepository(db));

export const configRouter = router({
  get: protectedProcedure.query(() => service.get()),

  updateTaxRates: guardedProcedure({ [RESOURCES.TAX_RATES]: [ACTIONS.UPDATE] })
    .input(updateTaxRatesSchema)
    .mutation(({ input }) => service.updateTaxRates(input)),

  updateQuoteDefaults: guardedProcedure({ [RESOURCES.QUOTE_DEFAULTS]: [ACTIONS.UPDATE] })
    .input(updateQuoteDefaultsSchema)
    .mutation(({ input }) => service.updateQuoteDefaults(input)),

  updateQuoteStages: guardedProcedure({ [RESOURCES.QUOTE_STAGES]: [ACTIONS.UPDATE] })
    .input(updateQuoteStagesSchema)
    .mutation(({ input }) => service.updateQuoteStages(input)),

  updateCatalogPreferences: guardedProcedure({ [RESOURCES.CATALOG_PREFERENCES]: [ACTIONS.UPDATE] })
    .input(updateCatalogPreferencesSchema)
    .mutation(({ input }) => service.updateCatalogPreferences(input)),
});
