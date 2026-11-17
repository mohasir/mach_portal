import { eq } from 'drizzle-orm';
import { db } from '../index';
import { appSettings } from '../schema';
import type { Executor } from '../index';

export type SeedAppSettings = Partial<Omit<typeof appSettings.$inferInsert, 'tenantId'>>;

const DEFAULT_APP_SETTINGS: SeedAppSettings = {
  depositRate: 0.5,
  quoteValidityMonths: 3,
  quoteSeqStart: 1,
  currency: 'USD',
  catalogSortable: false,
  defaultTaxRate: 0,
};

export async function seedConfig(
  tenantId: string,
  x: Executor = db,
  overrides: SeedAppSettings = {},
) {
  console.log('⚙️  Seeding configuración...');

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
