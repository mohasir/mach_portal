import { asc, eq } from 'drizzle-orm';
import type { AppSettingsInput, StateSettingInput } from '@repo/schemas';
import type { Database } from '../../db';
import { appSettings, stateSettings } from '../../db/schema';
import { publicAppSettingsColumns, publicStateSettingColumns } from './config.resource';

const APP_SETTINGS_ID = 1;

export class ConfigRepository {
  constructor(private db: Database) {}

  findStateSettings() {
    return this.db
      .select(publicStateSettingColumns)
      .from(stateSettings)
      .orderBy(asc(stateSettings.state));
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

  upsertAppSettings(data: AppSettingsInput) {
    return this.db
      .insert(appSettings)
      .values({ id: APP_SETTINGS_ID, ...data })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { ...data, updatedAt: new Date() },
      })
      .returning(publicAppSettingsColumns)
      .then((r) => r[0]!);
  }

  // Fase 4 hook-in point: once `quotes` exists, this becomes MAX(seq) FROM quotes.
  // No quotes yet, so the last used seq is trivially 0 (docs/mach-bar-plan.md
  // "Notas de secuenciación").
  async getLastUsedSeq(): Promise<number> {
    return 0;
  }
}
