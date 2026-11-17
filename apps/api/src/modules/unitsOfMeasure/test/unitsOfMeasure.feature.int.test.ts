import { beforeEach, describe, expect, it } from 'vitest';
import {
  ALL_TOGGLEABLE_FEATURES,
  addMemberWithGrants,
  createTestUser,
  resetDb,
  seedTwoTenants,
  testUnitId,
  type TestTenant,
} from '../../../test/db';
import { callerFor } from '../../../test/trpcCaller';

const notEnabled = { cause: { code: 'FEATURE_NOT_ENABLED' } };
const newUnit = {
  name: 'Bandeja',
  pluralName: 'Bandejas',
  code: 'bdj',
  dimension: 'quantity' as const,
  factor: '6',
};

describe('unitsOfMeasure add-on', () => {
  let tenant: TestTenant;
  let admin: { id: string };

  const setup = async (withAddon: boolean) => {
    await resetDb();
    ({ a: tenant } = await seedTwoTenants({
      features: withAddon
        ? ALL_TOGGLEABLE_FEATURES
        : ALL_TOGGLEABLE_FEATURES.filter((key) => key !== 'unitsOfMeasure'),
    }));
    admin = await createTestUser();
    await addMemberWithGrants(
      admin.id,
      tenant.id,
      (['create', 'read', 'update', 'disable', 'enable'] as const).map(
        (action) => ['unit_of_measure', action, 'all'] as const,
      ),
    );
  };

  describe('off', () => {
    beforeEach(() => setup(false));

    it('blocks every unit mutation but keeps the units readable', async () => {
      const caller = callerFor(tenant, admin).unitsOfMeasure;
      const id = await testUnitId(tenant.id, 'h');
      await expect(caller.create(newUnit)).rejects.toMatchObject(notEnabled);
      await expect(caller.update({ id, data: newUnit })).rejects.toMatchObject(notEnabled);
      await expect(caller.disable({ id })).rejects.toMatchObject(notEnabled);
      await expect(caller.enable({ id })).rejects.toMatchObject(notEnabled);
      expect((await caller.options()).length).toBeGreaterThan(0);
    });
  });

  describe('on', () => {
    beforeEach(() => setup(true));

    it('allows creating a unit', async () => {
      const created = await callerFor(tenant, admin).unitsOfMeasure.create(newUnit);
      expect(created).toMatchObject({ code: 'bdj' });
    });
  });
});
