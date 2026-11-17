import { beforeEach, describe, expect, it } from 'vitest';
import { asc } from 'drizzle-orm';
import { resetDb, seedTwoTenants, testDb, type TestTenant } from '../../../test/db';
import { tenantLocation, tenantLocationAreas } from '../../../db/schema';
import { LocationSettingsRepository } from '../locationSettings.repository';
import { LocationSettingsService } from '../locationSettings.service';

const service = (tenantId: string) =>
  new LocationSettingsService(new LocationSettingsRepository(testDb, tenantId));

describe('locationSettings isolation', () => {
  let a: TestTenant;
  let b: TestTenant;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    await service(a.id).update({
      enabled: true,
      country: 'US',
      depth: 2,
      scope: 'areas',
      areas: [
        { region: 'NY', locality: null },
        { region: 'NJ', locality: 'Newark' },
      ],
      askAddress: true,
    });
  });

  it('find reads only the own organization', async () => {
    expect((await service(b.id).get()).enabled).toBe(false);
    expect(await new LocationSettingsRepository(testDb, b.id).find()).toEqual({
      row: undefined,
      areas: [],
    });
  });

  it('save writes and replaces only the own rows', async () => {
    await service(b.id).update({
      enabled: true,
      country: 'NI',
      depth: 1,
      scope: 'areas',
      areas: [{ region: 'LE', locality: null }],
      askAddress: false,
    });
    await service(b.id).update({
      enabled: false,
      country: 'NI',
      depth: 1,
      scope: 'country',
      areas: [],
      askAddress: false,
    });

    expect(await service(a.id).get()).toMatchObject({
      enabled: true,
      country: 'US',
      areas: [
        { region: 'NJ', locality: 'Newark' },
        { region: 'NY', locality: null },
      ],
    });
    const rows = await testDb
      .select({ tenantId: tenantLocation.tenantId, country: tenantLocation.country })
      .from(tenantLocation)
      .orderBy(asc(tenantLocation.country));
    expect(rows).toEqual([
      { tenantId: b.id, country: 'NI' },
      { tenantId: a.id, country: 'US' },
    ]);
    const areas = await testDb
      .select({ tenantId: tenantLocationAreas.tenantId })
      .from(tenantLocationAreas);
    expect(areas.every((r) => r.tenantId === a.id)).toBe(true);
    expect(areas).toHaveLength(2);
  });
});
