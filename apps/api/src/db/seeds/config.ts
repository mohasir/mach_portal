import { and, eq } from 'drizzle-orm';
import type { StateValue } from '@repo/schemas';
import { db } from '../index';
import { appSettings, stateSettings } from '../schema';
import type { Executor } from '../index';

const SEED_STATE_SETTINGS: { state: StateValue; taxRate: number }[] = [
  { state: 'NY', taxRate: 0 }, // .08875
  { state: 'NJ', taxRate: 0 }, // .06625
  { state: 'CT', taxRate: 0 }, // .0635
];

export type SeedAppSettings = Partial<Omit<typeof appSettings.$inferInsert, 'tenantId'>>;

const DEFAULT_APP_SETTINGS: SeedAppSettings = {
  depositRate: 0.5,
  quoteValidityMonths: 3,
  minPersonsPerLine: 30,
  quoteSeqStart: 1,
  currency: 'USD',
  catalogSortable: false,
  cardSurchargeRate: 0.09,
};

export async function seedConfig(
  tenantId: string,
  x: Executor = db,
  overrides: SeedAppSettings = {},
) {
  console.log('⚙️  Seeding configuración...');

  for (const s of SEED_STATE_SETTINGS) {
    const [existing] = await x
      .select({ state: stateSettings.state })
      .from(stateSettings)
      .where(and(eq(stateSettings.tenantId, tenantId), eq(stateSettings.state, s.state)))
      .limit(1);
    if (existing) {
      console.log(`  ⏭️  ${s.state} ya existe, salteando`);
      continue;
    }
    await x.insert(stateSettings).values({ ...s, tenantId });
    console.log(`  ✅ ${s.state} (${(s.taxRate * 100).toFixed(3)}%)`);
  }

  const [existingApp] = await x
    .select({ tenantId: appSettings.tenantId })
    .from(appSettings)
    .where(eq(appSettings.tenantId, tenantId))
    .limit(1);
  if (existingApp) {
    console.log('  ⏭️  app_settings ya existe, salteando');
    return;
  }

  const values = { ...DEFAULT_APP_SETTINGS, ...overrides };
  await x.insert(appSettings).values({ ...values, tenantId });
  console.log(`  ✅ app_settings ${JSON.stringify(values)}`);
}
