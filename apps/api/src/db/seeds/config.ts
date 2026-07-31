import { eq } from 'drizzle-orm';
import type { StateValue } from '@repo/schemas';
import { db } from '../index';
import { appSettings, stateSettings } from '../schema';

const SEED_STATE_SETTINGS: { state: StateValue; taxRate: number }[] = [
  { state: 'NY', taxRate: 0 }, // .08875
  { state: 'NJ', taxRate: 0 }, // .06625
  { state: 'CT', taxRate: 0 }, // .0635
];

export async function seedConfig() {
  console.log('⚙️  Seeding configuración...');

  for (const s of SEED_STATE_SETTINGS) {
    const [existing] = await db
      .select({ state: stateSettings.state })
      .from(stateSettings)
      .where(eq(stateSettings.state, s.state))
      .limit(1);
    if (existing) {
      console.log(`  ⏭️  ${s.state} ya existe, salteando`);
      continue;
    }
    await db.insert(stateSettings).values(s);
    console.log(`  ✅ ${s.state} (${(s.taxRate * 100).toFixed(3)}%)`);
  }

  const [existingApp] = await db
    .select({ id: appSettings.id })
    .from(appSettings)
    .where(eq(appSettings.id, 1))
    .limit(1);
  if (existingApp) {
    console.log('  ⏭️  app_settings ya existe, salteando');
    return;
  }

  await db.insert(appSettings).values({
    id: 1,
    depositRate: 0.5,
    quoteValidityMonths: 3,
    minPersonsPerLine: 30,
    quoteSeqStart: 1,
    currency: 'USD',
    catalogSortable: false,
  });
  console.log(
    '  ✅ app_settings (deposit 50%, validez 3 meses, min 30 personas, seq desde 1, USD, catálogo ordenable)',
  );
}
