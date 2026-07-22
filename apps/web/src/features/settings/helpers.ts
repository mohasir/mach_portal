import type {
  QuoteStageColor,
  QuoteStageId,
  UpdateQuoteDefaultsInput,
  UpdateQuoteStagesInput,
  UpdateTaxRatesInput,
} from '@repo/schemas';
import { fromPercent, toPercent } from '@/lib/utils/percent';
import type { Config } from './types';

export interface TaxRatesFormValues {
  rates: { taxRatePercent: number }[];
}

export function toTaxRatesFormValues(config: Config): TaxRatesFormValues {
  return {
    rates: config.stateSettings.map((s) => ({ taxRatePercent: toPercent(s.taxRate) })),
  };
}

export function toTaxRatesUpdateInput(
  values: TaxRatesFormValues,
  config: Config,
): UpdateTaxRatesInput {
  return config.stateSettings.map((s, index) => ({
    state: s.state,
    taxRate: fromPercent(values.rates[index]!.taxRatePercent),
  }));
}

export interface QuoteDefaultsFormValues {
  depositRatePercent: number;
  quoteValidityMonths: number;
  minPersonsPerLine: number;
  quoteSeqStart: number;
  currency: string;
}

export function toQuoteDefaultsFormValues(config: Config): QuoteDefaultsFormValues {
  return {
    depositRatePercent: toPercent(config.appSettings.depositRate),
    quoteValidityMonths: config.appSettings.quoteValidityMonths,
    minPersonsPerLine: config.appSettings.minPersonsPerLine,
    quoteSeqStart: config.appSettings.quoteSeqStart,
    currency: config.appSettings.currency,
  };
}

export function toQuoteDefaultsUpdateInput(
  values: QuoteDefaultsFormValues,
): UpdateQuoteDefaultsInput {
  return {
    depositRate: fromPercent(values.depositRatePercent),
    quoteValidityMonths: values.quoteValidityMonths,
    minPersonsPerLine: values.minPersonsPerLine,
    quoteSeqStart: values.quoteSeqStart,
    currency: values.currency,
  };
}

export interface QuoteStagesFormValues {
  quoteStages: { id: QuoteStageId; label: string; color: QuoteStageColor; description?: string }[];
}

export function toQuoteStagesFormValues(config: Config): QuoteStagesFormValues {
  return {
    quoteStages: config.quoteStages.map((s) => ({
      id: s.id as QuoteStageId,
      label: s.label,
      color: s.color as QuoteStageColor,
      description: s.description ?? undefined,
    })),
  };
}

export function toQuoteStagesUpdateInput(values: QuoteStagesFormValues): UpdateQuoteStagesInput {
  return values.quoteStages.map((s) => ({
    id: s.id,
    label: s.label,
    color: s.color,
    description: s.description,
  }));
}
