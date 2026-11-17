import { beforeEach, describe, expect, it } from 'vitest';
import {
  ALL_TOGGLEABLE_FEATURES,
  addMemberWithGrants,
  createTestUser,
  resetDb,
  seedTwoTenants,
  testDb,
  type TestTenant,
} from '../../../test/db';
import { callerFor } from '../../../test/trpcCaller';
import { chargeTypes } from '../../../db/schema';

const notEnabled = { cause: { code: 'FEATURE_NOT_ENABLED', details: { feature: 'extraCharges' } } };
const freight = { name: 'Flete', kind: 'fixed' as const, defaultValue: 2500 };

describe('extraCharges add-on', () => {
  let tenant: TestTenant;
  let admin: { id: string };

  const setup = async (withAddon: boolean) => {
    await resetDb();
    ({ a: tenant } = await seedTwoTenants({
      features: withAddon
        ? ALL_TOGGLEABLE_FEATURES
        : ALL_TOGGLEABLE_FEATURES.filter((key) => key !== 'extraCharges'),
    }));
    admin = await createTestUser();
    await addMemberWithGrants(
      admin.id,
      tenant.id,
      (['create', 'read', 'update', 'disable', 'enable'] as const).map(
        (action) => ['charge_type', action, 'all'] as const,
      ),
    );
  };

  describe('off', () => {
    beforeEach(() => setup(false));

    it('blocks every catalog mutation but keeps the types readable', async () => {
      const [{ id }] = (await testDb
        .insert(chargeTypes)
        .values({ tenantId: tenant.id, ...freight })
        .returning({ id: chargeTypes.id })) as [{ id: string }];
      const caller = callerFor(tenant, admin).chargeTypes;
      await expect(caller.create(freight)).rejects.toMatchObject(notEnabled);
      await expect(caller.update({ id, data: freight })).rejects.toMatchObject(notEnabled);
      await expect(caller.disable({ id })).rejects.toMatchObject(notEnabled);
      await expect(caller.enable({ id })).rejects.toMatchObject(notEnabled);
      expect((await caller.options()).map((c) => c.name)).toEqual(['Flete']);
      expect((await caller.list({})).items).toHaveLength(1);
    });
  });

  describe('on', () => {
    beforeEach(() => setup(true));

    it('allows creating a charge type', async () => {
      await expect(callerFor(tenant, admin).chargeTypes.create(freight)).resolves.toMatchObject({
        name: 'Flete',
      });
    });

    it('requires the charge_type permission', async () => {
      const outsider = await createTestUser();
      await addMemberWithGrants(outsider.id, tenant.id, [['client', 'read', 'all']]);
      await expect(callerFor(tenant, outsider).chargeTypes.create(freight)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });
  });
});
