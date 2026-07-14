import { z } from 'zod';
import { stateSchema } from './enums';

const rateSchema = (message: string) => z.number().min(0, message).max(1, message);

export const stateSettingSchema = z.object({
  state: stateSchema,
  taxRate: rateSchema('config.validation.taxRateInvalid'),
});
export type StateSettingInput = z.infer<typeof stateSettingSchema>;

// ISO 4217 alpha code
const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, 'config.validation.currencyInvalid');

export const appSettingsSchema = z.object({
  depositRate: rateSchema('config.validation.depositRateInvalid'),
  quoteValidityMonths: z.number().int().min(1, 'config.validation.quoteValidityInvalid'),
  minPersonsPerLine: z.number().int().min(1, 'config.validation.minPersonsInvalid'),
  quoteSeqStart: z.number().int().min(1, 'config.validation.quoteSeqStartInvalid'),
  currency: currencyCodeSchema,
  catalogSortable: z.boolean(),
});
export type AppSettingsInput = z.infer<typeof appSettingsSchema>;

export const updateConfigSchema = z.object({
  stateSettings: z.array(stateSettingSchema).min(1),
  appSettings: appSettingsSchema,
});
export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;
