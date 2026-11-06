import {
  updateCatalogPreferencesSchema,
  updatePipelinePreferencesSchema,
  updateQuoteBuilderPreferencesSchema,
  updateQuoteDefaultsSchema,
  updateQuoteStagesSchema,
  updateTaxPreferencesSchema,
  updateTaxRatesSchema,
} from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure, protectedProcedure } from '../../core/trpc/trpc';
import { configModule } from './config.module';

export const configRouter = router({
  get: protectedProcedure.query(({ ctx }) => configModule(ctx).get()),

  updateTaxRates: guardedProcedure({ [RESOURCES.TAX_RATES]: [ACTIONS.UPDATE] })
    .input(updateTaxRatesSchema)
    .mutation(({ ctx, input }) => configModule(ctx).updateTaxRates(input)),

  updateTaxPreferences: guardedProcedure({ [RESOURCES.TAX_RATES]: [ACTIONS.UPDATE] })
    .input(updateTaxPreferencesSchema)
    .mutation(({ ctx, input }) => configModule(ctx).updateTaxPreferences(input)),

  updateQuoteDefaults: guardedProcedure({ [RESOURCES.QUOTE_DEFAULTS]: [ACTIONS.UPDATE] })
    .input(updateQuoteDefaultsSchema)
    .mutation(({ ctx, input }) => configModule(ctx).updateQuoteDefaults(input)),

  updateQuoteStages: guardedProcedure({ [RESOURCES.QUOTE_STAGES]: [ACTIONS.UPDATE] })
    .input(updateQuoteStagesSchema)
    .mutation(({ ctx, input }) => configModule(ctx).updateQuoteStages(input)),

  updateCatalogPreferences: guardedProcedure({ [RESOURCES.CATALOG_PREFERENCES]: [ACTIONS.UPDATE] })
    .input(updateCatalogPreferencesSchema)
    .mutation(({ ctx, input }) => configModule(ctx).updateCatalogPreferences(input)),

  updateQuoteBuilderPreferences: guardedProcedure({
    [RESOURCES.QUOTE_BUILDER_PREFERENCES]: [ACTIONS.UPDATE],
  })
    .input(updateQuoteBuilderPreferencesSchema)
    .mutation(({ ctx, input }) => configModule(ctx).updateQuoteBuilderPreferences(input)),

  updatePipelinePreferences: guardedProcedure({
    [RESOURCES.PIPELINE_PREFERENCES]: [ACTIONS.UPDATE],
  })
    .input(updatePipelinePreferencesSchema)
    .mutation(({ ctx, input }) => configModule(ctx).updatePipelinePreferences(input)),
});
