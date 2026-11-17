import { appSettings, quoteStages } from '../../db/schema';

export const publicQuoteStageColumns = {
  id: quoteStages.id,
  label: quoteStages.label,
  color: quoteStages.color,
  description: quoteStages.description,
  sortOrder: quoteStages.sortOrder,
} as const;

export const publicAppSettingsColumns = {
  depositRate: appSettings.depositRate,
  quoteValidityMonths: appSettings.quoteValidityMonths,
  quoteSeqStart: appSettings.quoteSeqStart,
  currency: appSettings.currency,
  catalogSortable: appSettings.catalogSortable,
  optionsSelectionDeadlineDays: appSettings.optionsSelectionDeadlineDays,
  allowSelectOptionsAtQuote: appSettings.allowSelectOptionsAtQuote,
  hideStaleQuotes: appSettings.hideStaleQuotes,
  defaultTaxRate: appSettings.defaultTaxRate,
  updatedAt: appSettings.updatedAt,
} as const;

export type PublicAppSettings = Pick<
  typeof appSettings.$inferSelect,
  keyof typeof publicAppSettingsColumns
>;
export type PublicQuoteStage = Pick<
  typeof quoteStages.$inferSelect,
  keyof typeof publicQuoteStageColumns
>;

export const appSettingsResource = (row: PublicAppSettings) => ({
  depositRate: row.depositRate,
  quoteValidityMonths: row.quoteValidityMonths,
  quoteSeqStart: row.quoteSeqStart,
  currency: row.currency,
  catalogSortable: row.catalogSortable,
  optionsSelectionDeadlineDays: row.optionsSelectionDeadlineDays,
  allowSelectOptionsAtQuote: row.allowSelectOptionsAtQuote,
  hideStaleQuotes: row.hideStaleQuotes,
  defaultTaxRate: row.defaultTaxRate,
  updatedAt: row.updatedAt,
});

export const quoteStageResource = (row: PublicQuoteStage) => ({
  id: row.id,
  label: row.label,
  color: row.color,
  description: row.description,
  sortOrder: row.sortOrder,
});

export const configResource = (
  appRow: PublicAppSettings,
  lastUsedSeq: number,
  quoteStageRows: PublicQuoteStage[],
) => ({
  appSettings: appSettingsResource(appRow),
  lastUsedSeq,
  quoteStages: quoteStageRows.map(quoteStageResource),
});

export type ConfigResource = ReturnType<typeof configResource>;
