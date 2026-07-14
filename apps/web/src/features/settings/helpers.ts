import type { UpdateConfigInput } from '@repo/schemas';
import { fromPercent, toPercent } from '@/lib/utils/percent';
import type { Config } from './types';

export interface SettingsFormValues {
  rates: { taxRatePercent: number }[];
  depositRatePercent: number;
  quoteValidityMonths: number;
  minPersonsPerLine: number;
  quoteSeqStart: number;
  currency: string;
}

export function toFormValues(config: Config): SettingsFormValues {
  return {
    rates: config.stateSettings.map((s) => ({ taxRatePercent: toPercent(s.taxRate) })),
    depositRatePercent: toPercent(config.appSettings.depositRate),
    quoteValidityMonths: config.appSettings.quoteValidityMonths,
    minPersonsPerLine: config.appSettings.minPersonsPerLine,
    quoteSeqStart: config.appSettings.quoteSeqStart,
    currency: config.appSettings.currency,
  };
}

export function toUpdateInput(values: SettingsFormValues, config: Config): UpdateConfigInput {
  return {
    stateSettings: config.stateSettings.map((s, index) => ({
      state: s.state,
      taxRate: fromPercent(values.rates[index]!.taxRatePercent),
    })),
    appSettings: {
      depositRate: fromPercent(values.depositRatePercent),
      quoteValidityMonths: values.quoteValidityMonths,
      minPersonsPerLine: values.minPersonsPerLine,
      quoteSeqStart: values.quoteSeqStart,
      currency: values.currency,
    },
  };
}
