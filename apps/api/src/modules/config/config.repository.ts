import { asc, eq, sql } from 'drizzle-orm';
import type { AppSettingsInput, StateSettingInput } from '@repo/schemas';
import type { Database } from '../../db';
import { appSettings, stateSettings, quotes } from '../../db/schema';
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

  async getLastUsedSeq(): Promise<number> {
    const [row] = await this.db
      .select({ value: sql<number>`coalesce(max(${quotes.seq}), 0)` })
      .from(quotes);
    return row?.value ?? 0;
  }
}
