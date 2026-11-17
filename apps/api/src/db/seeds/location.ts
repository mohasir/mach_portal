import { eq } from 'drizzle-orm';
import type { UpdateLocationSettingsInput } from '@repo/schemas';
import { db } from '../index';
import type { Executor } from '../index';
import { tenantLocation, tenantLocationAreas } from '../schema';

// Idempotent: an organization that already has location settings keeps them.
export async function seedLocationSettings(
  tenantId: string,
  settings: UpdateLocationSettingsInput,
  x: Executor = db,
) {
  console.log('📍 Seeding ubicación de operación...');
  const [existing] = await x
    .select({ tenantId: tenantLocation.tenantId })
    .from(tenantLocation)
    .where(eq(tenantLocation.tenantId, tenantId))
    .limit(1);
  if (existing) return;
  const { areas, ...row } = settings;
  await x.insert(tenantLocation).values({ ...row, tenantId });
  if (settings.scope === 'areas' && areas.length > 0) {
    await x.insert(tenantLocationAreas).values(areas.map((a) => ({ ...a, tenantId })));
  }
}
