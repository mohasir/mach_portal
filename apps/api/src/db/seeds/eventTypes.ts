import { eq } from 'drizzle-orm';
import { EVENT_TYPE_COLOR_PRESETS } from '@repo/schemas';
import { db } from '../index';
import { eventTypes } from '../schema';

const SEED_EVENT_TYPES: { name: string; color: (typeof EVENT_TYPE_COLOR_PRESETS)[number] }[] = [
  { name: 'Boda', color: '#722ed1' }, // purple
  { name: 'Cumpleaños', color: '#eb2f96' }, // magenta
  { name: 'Corporativo', color: '#8c8c8c' }, // grey
  { name: 'Baby Shower', color: '#fadb14' }, // yellow
  { name: 'Aniversario', color: '#fa541c' }, // volcano
  { name: 'Graduación', color: '#13c2c2' }, // cyan
  { name: 'Otro', color: '#1677ff' }, // blue (default)
];

export async function seedEventTypes() {
  console.log('🎉 Seeding tipos de evento...');

  for (const [index, { name, color }] of SEED_EVENT_TYPES.entries()) {
    const [existing] = await db
      .select({ id: eventTypes.id })
      .from(eventTypes)
      .where(eq(eventTypes.name, name))
      .limit(1);
    if (existing) {
      console.log(`  ⏭️  ${name} ya existe, salteando`);
      continue;
    }

    await db.insert(eventTypes).values({ name, color, sortOrder: index });
    console.log(`  ✅ ${name} (${color})`);
  }
}
