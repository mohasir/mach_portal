import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { TenantCtx } from '../../../core/trpc/tenantCtx';
import { userPreferences } from '../../../db/schema';
import { addMember, resetDb, seedTwoTenants, testDb, type TestTenant } from '../../../test/db';
import { UserPreferencesRepository } from '../userPreferences.repository';
import { userPreferencesModule } from '../userPreferences.module';

function moduleFor(tenant: TestTenant, userId: string) {
  return userPreferencesModule({
    tenantId: tenant.id,
    user: { id: userId },
  } as unknown as TenantCtx);
}

async function rowsOf(userId: string) {
  return testDb
    .select({ tenantId: userPreferences.tenantId, preferences: userPreferences.preferences })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));
}

describe('userPreferences tenant isolation', () => {
  let a: TestTenant;
  let b: TestTenant;
  let userId: string;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    userId = a.userId;
    await addMember(userId, b.id);
  });

  it('findByUserId does not read the same user preferences of another tenant', async () => {
    await testDb
      .insert(userPreferences)
      .values({ tenantId: b.id, userId, preferences: { locale: 'en' } });
    expect(await new UserPreferencesRepository(testDb, a.id).findByUserId(userId)).toBeUndefined();
    expect(
      (await new UserPreferencesRepository(testDb, b.id).findByUserId(userId))?.preferences,
    ).toEqual({ locale: 'en' });
  });

  it('merge writes only the tenant row and never another tenant row', async () => {
    await new UserPreferencesRepository(testDb, a.id).merge(userId, { locale: 'en' });
    await new UserPreferencesRepository(testDb, b.id).merge(userId, { locale: 'es' });
    await new UserPreferencesRepository(testDb, a.id).merge(userId, { timeFormat: '24h' });

    const rows = await rowsOf(userId);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.tenantId === a.id)?.preferences).toEqual({
      locale: 'en',
      timeFormat: '24h',
    });
    expect(rows.find((r) => r.tenantId === b.id)?.preferences).toEqual({ locale: 'es' });
  });

  it('upsert keeps one row per (tenant, user)', async () => {
    const repoA = new UserPreferencesRepository(testDb, a.id);
    await repoA.merge(userId, { locale: 'en' });
    await repoA.merge(userId, { locale: 'es' });
    await repoA.merge(userId, { quotesHideStale: true });
    const rows = await rowsOf(userId);
    expect(rows).toEqual([
      { tenantId: a.id, preferences: { locale: 'es', quotesHideStale: true } },
    ]);
  });

  it('service get/update are scoped to the tenant and the caller', async () => {
    await moduleFor(a, userId).update({ timeFormat: '24h' });
    expect((await moduleFor(a, userId).get()).timeFormat).toBe('24h');
    expect((await moduleFor(b, userId).get()).timeFormat).toBe('12h');

    await moduleFor(b, b.userId).update({ locale: 'en' });
    expect((await moduleFor(a, userId).get()).locale).toBeUndefined();
    expect(await rowsOf(b.userId)).toEqual([{ tenantId: b.id, preferences: { locale: 'en' } }]);
  });
});
