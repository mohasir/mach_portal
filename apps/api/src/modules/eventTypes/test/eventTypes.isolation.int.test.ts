import { beforeEach, describe, expect, it } from 'vitest';
import { eventTypesListQuerySchema, type CreateEventTypeInput } from '@repo/schemas';
import { eventTypes } from '../../../db/schema';
import { seedTwoTenants, resetDb, testDb, type TestTenant } from '../../../test/db';
import { EventTypesRepository } from '../eventTypes.repository';
import { EventTypesService } from '../eventTypes.service';

const listAll = eventTypesListQuerySchema.parse({});

async function insertType(tenant: TestTenant, name: string) {
  const [row] = await testDb
    .insert(eventTypes)
    .values({ tenantId: tenant.id, name })
    .returning({ id: eventTypes.id });
  return row!.id;
}

describe('eventTypes tenant isolation', () => {
  let a: TestTenant;
  let b: TestTenant;
  let repoA: EventTypesRepository;
  let repoB: EventTypesRepository;
  let typeA: string;
  let typeB: string;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    typeA = await insertType(a, 'Boda');
    typeB = await insertType(b, 'Cumple');
    await insertType(b, 'Gala');
    repoA = new EventTypesRepository(testDb, a.id);
    repoB = new EventTypesRepository(testDb, b.id);
  });

  it('findPaginated lists and counts only the tenant rows', async () => {
    const resA = await repoA.findPaginated(listAll);
    expect(resA.items.map((t) => t.name)).toEqual(['Boda']);
    const resB = await repoB.findPaginated(listAll);
    expect(resB.items).toHaveLength(2);
    expect(resB.total).toBe(2);
  });

  it('findPaginated search does not leak other tenant matches', async () => {
    const res = await repoA.findPaginated(eventTypesListQuerySchema.parse({ search: 'Cumple' }));
    expect(res.items).toEqual([]);
    expect(res.total).toBe(0);
  });

  it('findByName does not see other tenant names', async () => {
    expect(await repoA.findByName('Cumple')).toBeUndefined();
    expect(await repoA.findByName('Boda')).toEqual({ id: typeA });
  });

  it('create stamps the tenant and ignores a tenantId in the payload', async () => {
    const created = await repoA.create({
      name: 'Nuevo',
      color: '#000000',
      ...({ tenantId: b.id } as object),
    } as CreateEventTypeInput);
    const all = await testDb.select().from(eventTypes);
    expect(all.find((r) => r.id === created.id)?.tenantId).toBe(a.id);
  });

  it('updateById cannot touch another tenant row', async () => {
    expect(await repoA.updateById(typeB, { name: 'Hack', color: '#000000' })).toBeUndefined();
    const all = await testDb.select().from(eventTypes);
    expect(all.find((r) => r.id === typeB)?.name).toBe('Cumple');
  });

  it('setActive cannot touch another tenant row', async () => {
    expect(await repoA.setActive(typeB, false)).toBeUndefined();
    const all = await testDb.select().from(eventTypes);
    expect(all.find((r) => r.id === typeB)?.isActive).toBe(true);
  });

  it('the same name in two tenants does not conflict', async () => {
    const serviceA = new EventTypesService(repoA);
    const serviceB = new EventTypesService(repoB);
    await expect(serviceA.create({ name: 'Boda 2', color: '#000000' })).resolves.toBeDefined();
    await expect(serviceB.create({ name: 'Boda 2', color: '#000000' })).resolves.toBeDefined();
  });

  it('renaming to a name taken in the tenant is a CONFLICT, not a 500', async () => {
    const other = await insertType(a, 'Otro');
    const service = new EventTypesService(repoA);
    await expect(service.update(other, { name: 'Boda' })).rejects.toMatchObject({
      code: 'CONFLICT',
      cause: { code: 'EVENT_TYPE_ALREADY_EXISTS' },
    });
    await expect(service.update(other, { name: 'Cumple' })).resolves.toMatchObject({
      name: 'Cumple',
    });
  });

  it('a duplicate name within one tenant is still a conflict', async () => {
    await expect(
      new EventTypesService(repoA).create({ name: 'Boda', color: '#000000' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
