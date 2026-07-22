import { z } from 'zod';
import { stateSchema } from './enums';

const rateSchema = (message: string) => z.number().min(0, message).max(1, message);

export const stateSettingSchema = z.object({
  state: stateSchema,
  taxRate: rateSchema('config.validation.taxRateInvalid'),
});
export type StateSettingInput = z.infer<typeof stateSettingSchema>;

export const updateTaxRatesSchema = z.array(stateSettingSchema).min(1);
export type UpdateTaxRatesInput = z.infer<typeof updateTaxRatesSchema>;

// ISO 4217 alpha code
const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, 'config.validation.currencyInvalid');

export const updateQuoteDefaultsSchema = z.object({
  depositRate: rateSchema('config.validation.depositRateInvalid'),
  quoteValidityMonths: z.number().int().min(1, 'config.validation.quoteValidityInvalid'),
  minPersonsPerLine: z.number().int().min(1, 'config.validation.minPersonsInvalid'),
  quoteSeqStart: z.number().int().min(1, 'config.validation.quoteSeqStartInvalid'),
  currency: currencyCodeSchema,
});
export type UpdateQuoteDefaultsInput = z.infer<typeof updateQuoteDefaultsSchema>;

export const updateCatalogPreferencesSchema = z.object({
  catalogSortable: z.boolean(),
});
export type UpdateCatalogPreferencesInput = z.infer<typeof updateCatalogPreferencesSchema>;
