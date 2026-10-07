import { eq } from 'drizzle-orm';
import { db } from '../index';
import { rescheduleReasons } from '../schema';

const SEED_RESCHEDULE_REASONS: { name: string; requiresNote: boolean }[] = [
  { name: 'Solicitado por el cliente', requiresNote: false },
  { name: 'Clima', requiresNote: false },
  { name: 'Otro', requiresNote: true },
];

export async function seedRescheduleReasons() {
  console.log('📅 Seeding motivos de reprogramación...');

  for (const [index, { name, requiresNote }] of SEED_RESCHEDULE_REASONS.entries()) {
    const [existing] = await db
      .select({ id: rescheduleReasons.id })
      .from(rescheduleReasons)
      .where(eq(rescheduleReasons.name, name))
      .limit(1);
    if (existing) {
      console.log(`  ⏭️  ${name} ya existe, salteando`);
      continue;
    }

    await db.insert(rescheduleReasons).values({ name, requiresNote, sortOrder: index });
    console.log(`  ✅ ${name}`);
  }
}
