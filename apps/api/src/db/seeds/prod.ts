import { eq } from 'drizzle-orm';
import { db } from '../index';
import { user } from '../schema';
import { findOrganizationBySlug } from '../../lib/tenant/findOrganizationBySlug';
import { seedTenantDefaults } from './defaults';
import { seedQuoteStages } from './quoteStages';

export const PROD_SUPERADMIN_EMAIL = 'samuel@admin.com';

// `--demo=prod --tenant=<slug>`: global quote stages plus the defaults of an existing tenant.
// No account or membership is created here (real admins come from createTenant). The real
// superadmin, when its account exists, is only flagged as platform admin: a membership would
// exempt it from the platform-access audit and block its automatic active organization.
export async function seedProdTenant(slug: string) {
  const org = await findOrganizationBySlug(slug);
  if (!org) throw new Error(`Tenant "${slug}" does not exist`);

  await seedQuoteStages();
  await seedTenantDefaults(org.id);

  const [superadmin] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, PROD_SUPERADMIN_EMAIL));
  if (!superadmin) {
    console.log(`  ⏭️  ${PROD_SUPERADMIN_EMAIL} no existe, salteando admin de plataforma`);
    return;
  }
  await db.update(user).set({ isPlatformAdmin: true }).where(eq(user.id, superadmin.id));
  console.log(`  ✅ ${PROD_SUPERADMIN_EMAIL} es admin de plataforma`);
}
