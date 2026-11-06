import { db } from '../index';
import { organization } from '../schema';
import { seedDemoIntoTenant, seedDemoLocal } from './demo';
import { assertDemoAllowed } from './demoGuard';
import { seedProdTenant } from './prod';

export type SeedOptions = { demo: 'prod' | 'local'; tenant?: string };

export async function runSeed({ demo, tenant }: SeedOptions) {
  if (demo === 'prod') {
    if (!tenant) throw new Error('--demo=prod requires --tenant=<slug>.');
    return seedProdTenant(tenant);
  }

  const organizations = (await db.select({ slug: organization.slug }).from(organization)).map(
    (o) => o.slug,
  );
  assertDemoAllowed({ env: process.env.NODE_ENV, organizations, tenantFlag: tenant });

  if (!tenant) return seedDemoLocal();
  console.warn(
    `⚠️  Demo accounts with known passwords will be added to tenant "${tenant}". ` +
      'Do not do this on a real tenant.',
  );
  return seedDemoIntoTenant(tenant);
}
