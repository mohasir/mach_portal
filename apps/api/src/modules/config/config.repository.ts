import { asc, eq, sql } from 'drizzle-orm';
import type {
  QuoteStageCatalogItem,
  StateSettingInput,
  UpdateCatalogPreferencesInput,
  UpdateQuoteDefaultsInput,
} from '@repo/schemas';
import type { Database } from '../../db';
import { appSettings, stateSettings, quotes, quoteStages } from '../../db/schema';
import {
  publicAppSettingsColumns,
  publicQuoteStageColumns,
  publicStateSettingColumns,
} from './config.resource';

const APP_SETTINGS_ID = 1;

export class ConfigRepository {
  constructor(private db: Database) {}

  findStateSettings() {
    return this.db
      .select(publicStateSettingColumns)
      .from(stateSettings)
      .orderBy(asc(stateSettings.state));
  }

  findQuoteStages() {
    return this.db
      .select(publicQuoteStageColumns)
      .from(quoteStages)
      .orderBy(asc(quoteStages.sortOrder));
  }

  findAppSettings() {
    return this.db
      .select(publicAppSettingsColumns)
      .from(appSettings)
      .where(eq(appSettings.id, APP_SETTINGS_ID))
      .limit(1)
      .then((r) => r[0]);
  }

  async upsertStateSettings(rows: StateSettingInput[]) {
    await this.db.transaction(async (tx) => {
      await Promise.all(
        rows.map((row) =>
          tx
            .insert(stateSettings)
            .values(row)
            .onConflictDoUpdate({
              target: stateSettings.state,
              set: { taxRate: row.taxRate, updatedAt: new Date() },
            }),
        ),
      );
    });
  }

  updateQuoteDefaults(data: UpdateQuoteDefaultsInput) {
    return this.db
      .update(appSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(appSettings.id, APP_SETTINGS_ID))
      .returning(publicAppSettingsColumns)
      .then((r) => r[0]!);
  }

  updateCatalogPreferences(data: UpdateCatalogPreferencesInput) {
    return this.db
      .update(appSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(appSettings.id, APP_SETTINGS_ID))
      .returning(publicAppSettingsColumns)
      .then((r) => r[0]!);
  }

  // Fixed set of rows (ids hardcoded, see db/schema/quotes.ts) — only label/color/description are editable.
  async upsertQuoteStages(rows: QuoteStageCatalogItem[]) {
    await this.db.transaction(async (tx) => {
      await Promise.all(
        rows.map((row) =>
          tx
            .insert(quoteStages)
            .values({
              id: row.id,
              label: row.label,
              color: row.color,
              description: row.description ?? null,
              sortOrder: row.id,
            })
            .onConflictDoUpdate({
              target: quoteStages.id,
              set: { label: row.label, color: row.color, description: row.description ?? null },
            }),
        ),
      );
    });
  }

  async getLastUsedSeq(): Promise<number> {
    const [row] = await this.db
      .select({ value: sql<number>`coalesce(max(${quotes.seq}), 0)` })
      .from(quotes);
    return row?.value ?? 0;
  }
}
