import { and, eq } from 'drizzle-orm';
import { db } from '../index';
import { rescheduleReasons } from '../schema';
import type { Executor } from '../index';

const SEED_RESCHEDULE_REASONS: { name: string; requiresNote: boolean }[] = [
  { name: 'Solicitado por el cliente', requiresNote: false },
  { name: 'Clima', requiresNote: false },
  { name: 'Otro', requiresNote: true },
];

export async function seedRescheduleReasons(tenantId: string, x: Executor = db) {
  console.log('📅 Seeding motivos de reprogramación...');

  for (const [index, { name, requiresNote }] of SEED_RESCHEDULE_REASONS.entries()) {
    const [existing] = await x
      .select({ id: rescheduleReasons.id })
      .from(rescheduleReasons)
      .where(and(eq(rescheduleReasons.tenantId, tenantId), eq(rescheduleReasons.name, name)))
      .limit(1);
    if (existing) {
      console.log(`  ⏭️  ${name} ya existe, salteando`);
      continue;
    }

    await x.insert(rescheduleReasons).values({ name, requiresNote, sortOrder: index, tenantId });
    console.log(`  ✅ ${name}`);
  }
}
