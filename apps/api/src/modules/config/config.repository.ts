import { and, asc, eq, sql } from 'drizzle-orm';
import type {
  QuoteStageCatalogItem,
  StateSettingInput,
  UpdateCatalogPreferencesInput,
  UpdatePipelinePreferencesInput,
  UpdateQuoteBuilderPreferencesInput,
  UpdateQuoteDefaultsInput,
  UpdateTaxPreferencesInput,
} from '@repo/schemas';
import type { Database } from '../../db';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import {
  appSettings,
  stateSettings,
  quotes,
  quoteStages,
  quoteStageSettings,
} from '../../db/schema';
import { publicAppSettingsColumns, publicStateSettingColumns } from './config.resource';

export class ConfigRepository {
  constructor(
    private db: Database,
    private tenantId: string,
  ) {}

  findStateSettings() {
    return this.db
      .select(publicStateSettingColumns)
      .from(stateSettings)
      .where(tenantEq(stateSettings, this.tenantId))
      .orderBy(asc(stateSettings.state));
  }

  findQuoteStages() {
    return this.db
      .select({
        id: quoteStages.id,
        label: sql<string>`coalesce(${quoteStageSettings.label}, ${quoteStages.label})`,
        color: sql<string>`coalesce(${quoteStageSettings.color}, ${quoteStages.color})`,
        description: sql<
          string | null
        >`coalesce(${quoteStageSettings.description}, ${quoteStages.description})`,
        sortOrder: quoteStages.sortOrder,
      })
      .from(quoteStages)
      .leftJoin(
        quoteStageSettings,
        and(
          eq(quoteStageSettings.stageId, quoteStages.id),
          tenantEq(quoteStageSettings, this.tenantId),
        ),
      )
      .orderBy(asc(quoteStages.sortOrder));
  }

  findAppSettings() {
    return this.db
      .select(publicAppSettingsColumns)
      .from(appSettings)
      .where(tenantEq(appSettings, this.tenantId))
      .limit(1)
      .then((r) => r[0]);
  }

  async upsertStateSettings(rows: StateSettingInput[]) {
    await this.db.transaction(async (tx) => {
      await Promise.all(
        rows.map((row) =>
          tx
            .insert(stateSettings)
            .values({ ...row, tenantId: this.tenantId })
            .onConflictDoUpdate({
              target: [stateSettings.tenantId, stateSettings.state],
              set: { taxRate: row.taxRate, updatedAt: new Date() },
            }),
        ),
      );
    });
  }

  // A tenant without an app_settings row gets one (column defaults) on its first update.
  private upsertAppSettings(data: Omit<Partial<typeof appSettings.$inferInsert>, 'tenantId'>) {
    return this.db
      .insert(appSettings)
      .values({ ...data, tenantId: this.tenantId })
      .onConflictDoUpdate({
        target: appSettings.tenantId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning(publicAppSettingsColumns)
      .then((r) => r[0]!);
  }

  updateQuoteDefaults(data: UpdateQuoteDefaultsInput) {
    return this.upsertAppSettings(data);
  }

  updateCatalogPreferences(data: UpdateCatalogPreferencesInput) {
    return this.upsertAppSettings(data);
  }

  updateQuoteBuilderPreferences(data: UpdateQuoteBuilderPreferencesInput) {
    return this.upsertAppSettings(data);
  }

  updatePipelinePreferences(data: UpdatePipelinePreferencesInput) {
    return this.upsertAppSettings(data);
  }

  updateTaxPreferences(data: UpdateTaxPreferencesInput) {
    return this.upsertAppSettings(data);
  }

  // The global `quote_stages` rows are shared by every tenant and never written here; each
  // tenant customizes only its own overlay.
  async upsertQuoteStages(rows: QuoteStageCatalogItem[]) {
    await this.db.transaction(async (tx) => {
      await Promise.all(
        rows.map((row) => {
          const overrides = {
            label: row.label,
            color: row.color,
            description: row.description ?? null,
          };
          return tx
            .insert(quoteStageSettings)
            .values({ ...overrides, stageId: row.id, tenantId: this.tenantId })
            .onConflictDoUpdate({
              target: [quoteStageSettings.tenantId, quoteStageSettings.stageId],
              set: { ...overrides, updatedAt: new Date() },
            });
        }),
      );
    });
  }

  async getLastUsedSeq(): Promise<number> {
    const [row] = await this.db
      .select({ value: sql<number>`coalesce(max(${quotes.seq}), 0)` })
      .from(quotes)
      .where(tenantEq(quotes, this.tenantId));
    return row?.value ?? 0;
  }
}
