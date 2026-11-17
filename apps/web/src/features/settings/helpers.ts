import type {
  QuoteStageColor,
  QuoteStageId,
  UpdateQuoteDefaultsInput,
  UpdateQuoteStagesInput,
  UpdateTaxPreferencesInput,
} from '@repo/schemas';
import { fromPercent, toDisplayPercent, toPercent } from '@/lib/utils/percent';
import type { Config } from './types';

export interface DefaultTaxFormValues {
  defaultTaxRatePercent: number;
}

export const toDefaultTaxFormValues = (config: Config): DefaultTaxFormValues => ({
  defaultTaxRatePercent: toDisplayPercent(config.appSettings.defaultTaxRate),
});

// The rate is stored with 5 decimals; dividing by 100 can leave float noise past them.
export const toDefaultTaxUpdateInput = (
  values: DefaultTaxFormValues,
): UpdateTaxPreferencesInput => ({
  defaultTaxRate: Math.round(fromPercent(values.defaultTaxRatePercent) * 100000) / 100000,
});

export interface QuoteDefaultsFormValues {
  depositRatePercent: number;
  quoteValidityMonths: number;
  quoteSeqStart: number;
  currency: string;
  optionsSelectionDeadlineDays: number;
}

export function toQuoteDefaultsFormValues(config: Config): QuoteDefaultsFormValues {
  return {
    depositRatePercent: toPercent(config.appSettings.depositRate),
    quoteValidityMonths: config.appSettings.quoteValidityMonths,
    quoteSeqStart: Math.max(config.appSettings.quoteSeqStart, config.lastUsedSeq + 1),
    currency: config.appSettings.currency,
    optionsSelectionDeadlineDays: config.appSettings.optionsSelectionDeadlineDays,
  };
}

export function toQuoteDefaultsUpdateInput(
  values: QuoteDefaultsFormValues,
): UpdateQuoteDefaultsInput {
  return {
    depositRate: fromPercent(values.depositRatePercent),
    quoteValidityMonths: values.quoteValidityMonths,
    quoteSeqStart: values.quoteSeqStart,
    currency: values.currency,
    optionsSelectionDeadlineDays: values.optionsSelectionDeadlineDays,
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

/** Form submits only rendered fields; this restores the stored value of hidden ones. */
export const withStoredValues = <T extends object>(stored: T, submitted: T): T => ({
  ...stored,
  ...submitted,
});

export interface SettingsSectionGateInput {
  quotesActive: boolean;
  canTaxRates: boolean;
  canQuoteDefaults: boolean;
  canQuoteStages: boolean;
  canCatalogPreferences: boolean;
  canQuotePdfTemplate: boolean;
}

// The quote-related cards disappear without the `quotes` module, so a section is shown only while
// at least one of its cards still is. The preferences section keeps the catalog card either way.
export function visibleSettingsSections(input: SettingsSectionGateInput) {
  return {
    general:
      input.canTaxRates || (input.quotesActive && (input.canQuoteDefaults || input.canQuoteStages)),
    preferences: input.canCatalogPreferences,
    quotePdfTemplate: input.quotesActive && input.canQuotePdfTemplate,
  };
}
