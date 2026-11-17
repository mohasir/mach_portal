import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { chargeTypesListQuerySchema } from '@repo/schemas';
import { chargeTypes } from '../../../db/schema';
import { resetDb, seedTwoTenants, testDb, type TestTenant } from '../../../test/db';
import { ChargeTypesRepository } from '../chargeTypes.repository';
import { ChargeTypesService } from '../chargeTypes.service';

const listAll = chargeTypesListQuerySchema.parse({});
const notFound = { code: 'NOT_FOUND', cause: { code: 'CHARGE_TYPE_NOT_FOUND' } };
const foreign = { name: 'Ajeno', kind: 'fixed' as const, defaultValue: 100 };

describe('chargeTypes tenant isolation', () => {
  let a: TestTenant;
  let b: TestTenant;
  let repoA: ChargeTypesRepository;
  let serviceA: ChargeTypesService;
  let typeB: string;

  const stored = async (id: string) =>
    (await testDb.select().from(chargeTypes).where(eq(chargeTypes.id, id)))[0];

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    repoA = new ChargeTypesRepository(testDb, a.id);
    serviceA = new ChargeTypesService(repoA);
    const serviceB = new ChargeTypesService(new ChargeTypesRepository(testDb, b.id));
    typeB = (await serviceB.create(foreign)).id;
  });

  it('findPaginated lists, searches and counts only the tenant rows', async () => {
    await serviceA.create({ ...foreign, name: 'Propio' });
    const res = await repoA.findPaginated(listAll);
    expect(res.items.map((c) => c.name)).toEqual(['Propio']);
    const searched = await repoA.findPaginated(
      chargeTypesListQuerySchema.parse({ search: 'Ajeno', page: 1, pageSize: 5 }),
    );
    expect(searched).toMatchObject({ items: [], total: 0 });
  });

  it('options, findById and findByIds never return another tenant type', async () => {
    expect(await serviceA.options()).toEqual([]);
    expect(await repoA.findById(typeB)).toBeUndefined();
    expect(await repoA.findByIds([typeB])).toEqual([]);
  });

  it('findByName does not see another tenant name', async () => {
    expect(await repoA.findByName('ajeno')).toBeUndefined();
    await expect(serviceA.create(foreign)).resolves.toMatchObject({ name: 'Ajeno' });
  });

  it('new types are numbered within the tenant', async () => {
    await expect(serviceA.create({ ...foreign, name: 'Primero' })).resolves.toMatchObject({
      sortOrder: 0,
    });
  });

  it('cannot update, disable or enable another tenant type', async () => {
    await expect(serviceA.update(typeB, { ...foreign, name: 'Hack' })).rejects.toMatchObject(
      notFound,
    );
    await expect(serviceA.disable(typeB)).rejects.toMatchObject(notFound);
    await expect(serviceA.enable(typeB)).rejects.toMatchObject(notFound);
    expect(await stored(typeB)).toMatchObject({ name: 'Ajeno', isActive: true });
  });
});
