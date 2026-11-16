import { SYSTEM_UNITS } from '@repo/schemas';
import { db } from '../index';
import { unitsOfMeasure } from '../schema';
import type { Executor } from '../index';

// Idempotent by code: an existing code is left as the organization edited it.
export async function seedUnitsOfMeasure(tenantId: string, x: Executor = db): Promise<void> {
  console.log('📏 Seeding unidades de medida...');

  const inserted = await x
    .insert(unitsOfMeasure)
    .values(
      SYSTEM_UNITS.map((unit, index) => ({
        name: unit.name,
        pluralName: unit.pluralName,
        code: unit.code,
        dimension: unit.dimension,
        factor: unit.factor,
        isBase: unit.isBase,
        isSystem: true,
        sortOrder: index,
        tenantId,
      })),
    )
    .onConflictDoNothing({ target: [unitsOfMeasure.tenantId, unitsOfMeasure.code] })
    .returning({ id: unitsOfMeasure.id });

  console.log(
    `  ✅ ${inserted.length} nuevas, ${SYSTEM_UNITS.length - inserted.length} ya existían`,
  );
}
