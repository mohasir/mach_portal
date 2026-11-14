import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { FEATURE_KEYS, FEATURES } from '@repo/guards';
import { tenantFeatures } from '../../../db/schema';
import { resetDb, seedTwoTenants, testDb, type TestTenant } from '../../../test/db';
import { callerFor } from '../../../test/trpcCaller';

const CORE = FEATURE_KEYS.filter((k) => FEATURES[k].kind === 'core');
const FUTURE = new Date('2099-01-01T00:00:00.000Z');
const PAST = new Date('2000-01-01T00:00:00.000Z');

describe('features.mine', () => {
  let a: TestTenant;
  let b: TestTenant;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants({ features: [] }));
    await testDb.insert(tenantFeatures).values([
      { tenantId: a.id, featureKey: 'quotes' },
      { tenantId: a.id, featureKey: 'events', expiresAt: FUTURE },
      { tenantId: a.id, featureKey: 'priceTiers', enabled: false },
      { tenantId: a.id, featureKey: 'notifications', expiresAt: PAST },
      { tenantId: b.id, featureKey: 'configurableOptions' },
    ]);
  });

  it("returns the caller's active features: core with no expiry, the rest with their stored one", async () => {
    // A plain member: the query needs no role permission.
    const { features } = await callerFor(a, { id: a.userId }).features.mine();

    expect(features.map((f) => f.key).sort()).toEqual([...CORE, 'events', 'quotes'].sort());
    for (const key of CORE) {
      expect(features.find((f) => f.key === key)).toEqual({ key, expiresAt: null });
    }
    expect(features.find((f) => f.key === 'quotes')).toEqual({ key: 'quotes', expiresAt: null });
    expect(features.find((f) => f.key === 'events')).toEqual({
      key: 'events',
      expiresAt: FUTURE.toISOString(),
    });
  });

  it('never returns the features of another organization', async () => {
    const mineA = await callerFor(a, { id: a.userId }).features.mine();
    const mineB = await callerFor(b, { id: b.userId }).features.mine();

    expect(mineA.features.map((f) => f.key)).not.toContain('configurableOptions');
    expect(mineB.features.map((f) => f.key).sort()).toEqual(
      [...CORE, 'configurableOptions'].sort(),
    );
  });

  it('drops a feature whose requirement is inactive', async () => {
    await testDb
      .update(tenantFeatures)
      .set({ enabled: false })
      .where(and(eq(tenantFeatures.tenantId, a.id), eq(tenantFeatures.featureKey, 'quotes')));

    const { features } = await callerFor(a, { id: a.userId }).features.mine();
    expect(features.map((f) => f.key).sort()).toEqual([...CORE].sort());
  });

  it('rejects a user who is not a member of the active organization', async () => {
    await expect(callerFor(a, { id: b.userId }).features.mine()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
