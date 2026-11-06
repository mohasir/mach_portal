import { db } from '../index';
import { seedCatalog, SEED_CATALOG, type SeedProduct } from './catalog';
import { seedConfig, type SeedAppSettings } from './config';
import { seedEventTypes } from './eventTypes';
import type { Executor } from '../index';
import { seedQuotePdfTemplate } from './quotePdfTemplate';
import { seedRescheduleReasons } from './rescheduleReasons';

export type TenantDefaultsOptions = { catalog?: SeedProduct[]; appSettings?: SeedAppSettings };

// The data a tenant needs to be usable from its first request: config rows (config.get and quote
// numbering read them), event types, reschedule reasons, the base catalog and the quote PDF
// template. `quote_stages` is a global catalog and is seeded separately. Idempotent.
export async function seedTenantDefaults(
  tenantId: string,
  x: Executor = db,
  options: TenantDefaultsOptions = {},
): Promise<void> {
  await seedConfig(tenantId, x, options.appSettings);
  await seedEventTypes(tenantId, x);
  await seedRescheduleReasons(tenantId, x);
  await seedCatalog(tenantId, x, options.catalog ?? SEED_CATALOG);
  await seedQuotePdfTemplate(tenantId, x);
}
