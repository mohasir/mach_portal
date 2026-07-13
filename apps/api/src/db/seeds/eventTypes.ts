import { eq } from 'drizzle-orm';
import { db } from '../index';
import { eventTypes } from '../schema';

const SEED_EVENT_TYPES = [
  'Boda',
  'Cumpleaños',
  'Corporativo',
  'Baby Shower',
  'Aniversario',
  'Graduación',
  'Otro',
];

export async function seedEventTypes() {
  console.log('🎉 Seeding tipos de evento...');

  for (const [index, name] of SEED_EVENT_TYPES.entries()) {
    const [existing] = await db.select({ id: eventTypes.id }).from(eventTypes).where(eq(eventTypes.name, name)).limit(1);
    if (existing) {
      console.log(`  ⏭️  ${name} ya existe, salteando`);
      continue;
    }

    await db.insert(eventTypes).values({ name, sortOrder: index });
    console.log(`  ✅ ${name}`);
  }
}
