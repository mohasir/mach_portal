import { appSettings, stateSettings } from '../../db/schema';

export const publicStateSettingColumns = {
  state: stateSettings.state,
  taxRate: stateSettings.taxRate,
  updatedAt: stateSettings.updatedAt,
} as const;

export const publicAppSettingsColumns = {
  depositRate: appSettings.depositRate,
  quoteValidityMonths: appSettings.quoteValidityMonths,
  minPersonsPerLine: appSettings.minPersonsPerLine,
  quoteSeqStart: appSettings.quoteSeqStart,
  currency: appSettings.currency,
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
  updatedAt: row.updatedAt,
});

// `lastUsedSeq` is a read-only hint for the settings form (min bound + caption on
// quoteSeqStart), not a column — docs/mach-bar-flows.md §5.2/§5.4.
export const configResource = (
  stateRows: PublicStateSetting[],
  appRow: PublicAppSettings,
  lastUsedSeq: number,
) => ({
  stateSettings: stateRows.map(stateSettingResource),
  appSettings: appSettingsResource(appRow),
  lastUsedSeq,
});

export type ConfigResource = ReturnType<typeof configResource>;
