import type { QuoteStageColor, QuoteStageId, UpdateConfigInput } from '@repo/schemas';
import { fromPercent, toPercent } from '@/lib/utils/percent';
import type { Config } from './types';

export interface SettingsFormValues {
  rates: { taxRatePercent: number }[];
  depositRatePercent: number;
  quoteValidityMonths: number;
  minPersonsPerLine: number;
  quoteSeqStart: number;
  currency: string;
  quoteStages: { id: QuoteStageId; label: string; color: QuoteStageColor; description?: string }[];
}

export function toFormValues(config: Config): SettingsFormValues {
  return {
    rates: config.stateSettings.map((s) => ({ taxRatePercent: toPercent(s.taxRate) })),
    depositRatePercent: toPercent(config.appSettings.depositRate),
    quoteValidityMonths: config.appSettings.quoteValidityMonths,
    minPersonsPerLine: config.appSettings.minPersonsPerLine,
    quoteSeqStart: config.appSettings.quoteSeqStart,
    currency: config.appSettings.currency,
    quoteStages: config.quoteStages.map((s) => ({
      id: s.id as QuoteStageId,
      label: s.label,
      color: s.color as QuoteStageColor,
      description: s.description ?? undefined,
    })),
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
      catalogSortable: config.appSettings.catalogSortable,
    },
    quoteStages: values.quoteStages.map((s) => ({
      id: s.id,
      label: s.label,
      color: s.color,
      description: s.description,
    })),
  };
}
