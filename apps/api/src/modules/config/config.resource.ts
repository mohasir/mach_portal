import { appSettings, stateSettings, quoteStages } from '../../db/schema';

export const publicStateSettingColumns = {
  state: stateSettings.state,
  taxRate: stateSettings.taxRate,
  updatedAt: stateSettings.updatedAt,
} as const;

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
  minPersonsPerLine: appSettings.minPersonsPerLine,
  quoteSeqStart: appSettings.quoteSeqStart,
  currency: appSettings.currency,
  catalogSortable: appSettings.catalogSortable,
  updatedAt: appSettings.updatedAt,
} as const;

export type PublicStateSetting = Pick<
  typeof stateSettings.$inferSelect,
  keyof typeof publicStateSettingColumns
>;
export type PublicAppSettings = Pick<
  typeof appSettings.$inferSelect,
  keyof typeof publicAppSettingsColumns
>;
export type PublicQuoteStage = Pick<
  typeof quoteStages.$inferSelect,
  keyof typeof publicQuoteStageColumns
>;

export const stateSettingResource = (row: PublicStateSetting) => ({
  state: row.state,
  taxRate: row.taxRate,
  updatedAt: row.updatedAt,
});

export const appSettingsResource = (row: PublicAppSettings) => ({
  depositRate: row.depositRate,
  quoteValidityMonths: row.quoteValidityMonths,
  minPersonsPerLine: row.minPersonsPerLine,
  quoteSeqStart: row.quoteSeqStart,
  currency: row.currency,
  catalogSortable: row.catalogSortable,
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
  stateRows: PublicStateSetting[],
  appRow: PublicAppSettings,
  lastUsedSeq: number,
  quoteStageRows: PublicQuoteStage[],
) => ({
  stateSettings: stateRows.map(stateSettingResource),
  appSettings: appSettingsResource(appRow),
  lastUsedSeq,
  quoteStages: quoteStageRows.map(quoteStageResource),
});

export type ConfigResource = ReturnType<typeof configResource>;
