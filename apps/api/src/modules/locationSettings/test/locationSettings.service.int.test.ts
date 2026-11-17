import { beforeEach, describe, expect, it } from 'vitest';
import type { UpdateLocationSettingsInput } from '@repo/schemas';
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
import { tenantLocation, tenantLocationAreas } from '../../../db/schema';

const OFF = {
  enabled: false,
  country: null,
  depth: null,
  scope: null,
  areas: [],
  askAddress: false,
};

const usWhole: UpdateLocationSettingsInput = {
  enabled: true,
  country: 'US',
  depth: 2,
  scope: 'country',
  areas: [],
  askAddress: true,
};

const fails = (code: string) => ({ cause: { code } });

describe('locationSettings', () => {
  let tenant: TestTenant;
  let admin: { id: string };
  const settings = () => callerFor(tenant, admin).locationSettings;
  const storedRows = async () => ({
    location: await testDb.select().from(tenantLocation),
    areas: await testDb.select().from(tenantLocationAreas),
  });

  beforeEach(async () => {
    await resetDb();
    ({ a: tenant } = await seedTwoTenants());
    admin = await createTestUser();
    await addMemberWithGrants(admin.id, tenant.id, [
      ['location_settings', 'view', 'all'],
      ['location_settings', 'update', 'all'],
    ]);
  });

  it('reads as turned off for an organization without settings', async () => {
    expect(await settings().get()).toEqual(OFF);
  });

  it('activates with a complete form', async () => {
    expect(await settings().update(usWhole)).toEqual(usWhole);
    expect(await settings().get()).toEqual(usWhole);
  });

  it.each([
    ['country', { country: null }],
    ['depth', { depth: null }],
    ['scope', { scope: null }],
  ])('rejects activating without %s and writes nothing', async (_, missing) => {
    await expect(settings().update({ ...usWhole, ...missing })).rejects.toMatchObject(
      fails('LOCATION_SETTINGS_INCOMPLETE'),
    );
    expect(await storedRows()).toEqual({ location: [], areas: [] });
  });

  it('keeps the active configuration when an incomplete activation is rejected', async () => {
    await settings().update({
      ...usWhole,
      scope: 'areas',
      areas: [{ region: 'NY', locality: null }],
    });
    await expect(settings().update({ ...usWhole, depth: null })).rejects.toMatchObject(
      fails('LOCATION_SETTINGS_INCOMPLETE'),
    );
    expect(await settings().get()).toMatchObject({
      enabled: true,
      scope: 'areas',
      areas: [{ region: 'NY', locality: null }],
    });
  });

  it('is backed by a database check: an enabled row needs country, depth and scope', async () => {
    await expect(
      testDb.insert(tenantLocation).values({ tenantId: tenant.id, enabled: true, country: 'US' }),
    ).rejects.toMatchObject({
      cause: { constraint_name: 'tenant_location_enabled_complete_check' },
    });
  });

  it('rejects covering areas without any area', async () => {
    await expect(
      settings().update({ ...usWhole, scope: 'areas', areas: [] }),
    ).rejects.toMatchObject(fails('LOCATION_SETTINGS_AREAS_REQUIRED'));
    expect(await storedRows()).toEqual({ location: [], areas: [] });
  });

  it.each([
    ['an unknown region', { region: 'ZZ', locality: null }],
    ['a locality of another region', { region: 'NY', locality: 'Paterson' }],
    ['an unknown locality', { region: 'NJ', locality: 'Atlantis' }],
  ])('rejects %s as an area and writes nothing', async (_, area) => {
    await expect(
      settings().update({ ...usWhole, scope: 'areas', areas: [area] }),
    ).rejects.toMatchObject(fails('LOCATION_SETTINGS_INVALID_AREA'));
    expect(await storedRows()).toEqual({ location: [], areas: [] });
  });

  it('rejects a country without a dataset', async () => {
    await expect(settings().update({ ...usWhole, country: 'MX' })).rejects.toMatchObject(
      fails('LOCATION_SETTINGS_INVALID_COUNTRY'),
    );
  });

  it('rejects a depth past the levels of the country', async () => {
    await expect(
      settings().update({ ...usWhole, depth: 3 } as unknown as UpdateLocationSettingsInput),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(await storedRows()).toEqual({ location: [], areas: [] });
  });

  it.each([
    ['a locality area below the depth', 1, [{ region: 'NY', locality: 'Albany' }]],
    ['areas on a country-only depth', 0, [{ region: 'NY', locality: null }]],
  ] as const)('rejects %s', async (_, depth, areas) => {
    await expect(
      settings().update({ ...usWhole, depth, scope: 'areas', areas: [...areas] }),
    ).rejects.toMatchObject(fails('LOCATION_SETTINGS_AREA_BEYOND_DEPTH'));
  });

  it('replaces the areas on each save, without duplicates or areas a region already covers', async () => {
    await settings().update({
      ...usWhole,
      scope: 'areas',
      areas: [{ region: 'CT', locality: 'Hartford' }],
    });
    const saved = await settings().update({
      ...usWhole,
      scope: 'areas',
      areas: [
        { region: 'NY', locality: 'Albany' },
        { region: 'NY', locality: null },
        { region: 'NJ', locality: 'Newark' },
        { region: 'NJ', locality: 'Newark' },
      ],
    });
    expect(saved.areas).toEqual([
      { region: 'NJ', locality: 'Newark' },
      { region: 'NY', locality: null },
    ]);
    expect((await storedRows()).areas).toHaveLength(2);
  });

  it('drops the areas when the scope goes back to the whole country', async () => {
    await settings().update({
      ...usWhole,
      scope: 'areas',
      areas: [{ region: 'NY', locality: null }],
    });
    expect(await settings().update(usWhole)).toEqual(usWhole);
    expect((await storedRows()).areas).toEqual([]);
  });

  it('accepts Nicaragua with its autonomous regions and municipalities', async () => {
    const ni: UpdateLocationSettingsInput = {
      enabled: true,
      country: 'NI',
      depth: 2,
      scope: 'areas',
      areas: [
        { region: 'RACCN', locality: null },
        { region: 'MN', locality: 'Managua' },
      ],
      askAddress: false,
    };
    expect(await settings().update(ni)).toEqual({
      ...ni,
      areas: [
        { region: 'MN', locality: 'Managua' },
        { region: 'RACCN', locality: null },
      ],
    });
  });

  it('turns off keeping the configuration, and saves a partial form while off', async () => {
    await settings().update(usWhole);
    expect(await settings().update({ ...usWhole, enabled: false })).toEqual({
      ...usWhole,
      enabled: false,
    });
    expect(await settings().update({ ...OFF, country: 'NI' })).toEqual({ ...OFF, country: 'NI' });
  });

  it('lets any member read the settings but only location_settings.update change them', async () => {
    const operator = await createTestUser();
    await addMemberWithGrants(operator.id, tenant.id, [['quote', 'create', 'own']]);
    await settings().update(usWhole);
    expect(await callerFor(tenant, operator).locationSettings.get()).toEqual(usWhole);
    await expect(
      callerFor(tenant, operator).locationSettings.update({ ...usWhole, enabled: false }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await settings().get()).enabled).toBe(true);
  });

  it('is gated by the quotes module', async () => {
    await resetDb();
    ({ a: tenant } = await seedTwoTenants({
      features: ALL_TOGGLEABLE_FEATURES.filter((k) => k !== 'quotes' && k !== 'events'),
    }));
    admin = await createTestUser();
    await addMemberWithGrants(admin.id, tenant.id, [['location_settings', 'update', 'all']]);
    await expect(settings().update(usWhole)).rejects.toMatchObject(fails('FEATURE_NOT_ENABLED'));
  });
});
