import { z } from 'zod';

const rateSchema = (message: string) => z.number().min(0, message).max(1, message);

export const taxRateSchema = rateSchema('config.validation.taxRateInvalid');

export const updateTaxPreferencesSchema = z.object({
  defaultTaxRate: taxRateSchema,
});
export type UpdateTaxPreferencesInput = z.infer<typeof updateTaxPreferencesSchema>;

// ISO 4217 alpha code
const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, 'config.validation.currencyInvalid');

export const updateQuoteDefaultsSchema = z.object({
  depositRate: rateSchema('config.validation.depositRateInvalid'),
  quoteValidityMonths: z.number().int().min(1, 'config.validation.quoteValidityInvalid'),
  quoteSeqStart: z.number().int().min(1, 'config.validation.quoteSeqStartInvalid'),
  currency: currencyCodeSchema,
  optionsSelectionDeadlineDays: z
    .number()
    .int()
    .min(0, 'config.validation.optionsSelectionDeadlineDaysInvalid'),
});
export type UpdateQuoteDefaultsInput = z.infer<typeof updateQuoteDefaultsSchema>;

export const updateCatalogPreferencesSchema = z.object({
  catalogSortable: z.boolean(),
});
export type UpdateCatalogPreferencesInput = z.infer<typeof updateCatalogPreferencesSchema>;

export const updateQuoteBuilderPreferencesSchema = z.object({
  allowSelectOptionsAtQuote: z.boolean(),
});
export type UpdateQuoteBuilderPreferencesInput = z.infer<
  typeof updateQuoteBuilderPreferencesSchema
>;

export const updatePipelinePreferencesSchema = z.object({
  hideStaleQuotes: z.boolean(),
});
export type UpdatePipelinePreferencesInput = z.infer<typeof updatePipelinePreferencesSchema>;
