import { and, eq } from 'drizzle-orm';
import type { ChargeKind } from '@repo/schemas';
import { db } from '../index';
import type { Executor } from '../index';
import { chargeTypes } from '../schema';

export interface SeedChargeType {
  name: string;
  kind: ChargeKind;
  // Cents for a fixed charge, a rate for a percent one.
  defaultValue: number;
}

export const SEED_CHARGE_TYPES: SeedChargeType[] = [
  { name: 'Traslado', kind: 'fixed', defaultValue: 5000 },
  { name: 'Recargo por pago con tarjeta', kind: 'percent', defaultValue: 0.03 },
];

// Idempotent by name: an existing type of the tenant is left as it is.
export async function seedChargeTypes(
  tenantId: string,
  x: Executor = db,
  types: SeedChargeType[] = SEED_CHARGE_TYPES,
) {
  console.log('💲 Seeding cargos adicionales...');
  for (const [sortOrder, type] of types.entries()) {
    const [existing] = await x
      .select({ id: chargeTypes.id })
      .from(chargeTypes)
      .where(and(eq(chargeTypes.tenantId, tenantId), eq(chargeTypes.name, type.name)))
      .limit(1);
    if (existing) continue;
    await x.insert(chargeTypes).values({ ...type, sortOrder, tenantId });
  }
}
