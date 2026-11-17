import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { unitsOfMeasureListQuerySchema, type CreateUnitInput } from '@repo/schemas';
import {
  clients,
  products,
  quoteLines,
  quoteStages,
  quotes,
  unitsOfMeasure,
} from '../../../db/schema';
import { resetDb, seedTwoTenants, testDb, testUnitId, type TestTenant } from '../../../test/db';
import { UnitsOfMeasureRepository } from '../unitsOfMeasure.repository';
import { UnitsOfMeasureService } from '../unitsOfMeasure.service';

const listAll = unitsOfMeasureListQuerySchema.parse({});

const own: CreateUnitInput = {
  name: 'Bandeja',
  pluralName: 'Bandejas',
  code: 'bdj',
  dimension: 'quantity',
  factor: '6',
};

describe('unitsOfMeasure tenant isolation', () => {
  let a: TestTenant;
  let b: TestTenant;
  let repoA: UnitsOfMeasureRepository;
  let serviceA: UnitsOfMeasureService;
  let serviceB: UnitsOfMeasureService;
  let unitB: string;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    repoA = new UnitsOfMeasureRepository(testDb, a.id);
    serviceA = new UnitsOfMeasureService(repoA);
    serviceB = new UnitsOfMeasureService(new UnitsOfMeasureRepository(testDb, b.id));
    unitB = (await serviceB.create(own)).id;
  });

  it('findPaginated lists and counts only the tenant rows', async () => {
    const resA = await repoA.findPaginated(listAll);
    expect(resA.items).toHaveLength(23);
    expect(resA.items.map((u) => u.code)).not.toContain('bdj');
    const paged = await repoA.findPaginated(
      unitsOfMeasureListQuerySchema.parse({ page: 1, pageSize: 5 }),
    );
    expect(paged.total).toBe(23);
  });

  it('search does not leak other tenant matches', async () => {
    const res = await repoA.findPaginated(
      unitsOfMeasureListQuerySchema.parse({ search: 'Bandeja' }),
    );
    expect(res.items).toEqual([]);
  });

  it('isUsed only counts products of the tenant', async () => {
    await testDb
      .insert(products)
      .values({ tenantId: b.id, name: 'Usa pers', taxRate: 0, uomId: await testUnitId(b.id) });
    const { items } = await serviceA.list(listAll);
    expect(items.find((u) => u.code === 'pers')?.isUsed).toBe(false);
  });

  it('findById, findByCode and the usage checks do not see other tenant rows', async () => {
    expect(await repoA.findById(unitB)).toBeUndefined();
    expect(await repoA.findByCode('bdj')).toBeUndefined();
    await testDb
      .insert(products)
      .values({ tenantId: b.id, name: 'Usa bdj', taxRate: 0, uomId: unitB });
    expect(await repoA.isUsed(unitB)).toBe(false);
    expect(await repoA.blocksDeactivation(unitB)).toBe(false);
  });

  it('quote lines of another tenant do not count as usage', async () => {
    const unitA = await testUnitId(a.id, 'pers');
    const [product] = await testDb
      .insert(products)
      .values({ tenantId: b.id, name: 'Menu B', taxRate: 0, uomId: await testUnitId(b.id) })
      .returning({ id: products.id });
    await testDb
      .insert(quoteStages)
      .values({ id: 1, label: 'stage 1', color: '#000000', sortOrder: 1 })
      .onConflictDoNothing();
    const [client] = await testDb
      .insert(clients)
      .values({ tenantId: b.id, name: 'Client B' })
      .returning({ id: clients.id });
    const [quote] = await testDb
      .insert(quotes)
      .values({ tenantId: b.id, seq: 1, number: 'Q-B-1', clientId: client!.id })
      .returning({ id: quotes.id });
    await testDb.insert(quoteLines).values({
      tenantId: b.id,
      quoteId: quote!.id,
      productId: product!.id,
      uomId: unitA,
      quantity: 1,
      subtotal: 100,
      taxRate: 0,
      taxAmount: 0,
    });
    expect(await repoA.isUsed(unitA)).toBe(false);
    expect(await repoA.blocksDeactivation(unitA)).toBe(false);
    expect((await serviceA.list(listAll)).items.find((u) => u.id === unitA)?.isUsed).toBe(false);
  });

  it('the same code in two tenants does not conflict', async () => {
    await expect(serviceA.create(own)).resolves.toMatchObject({ code: 'bdj' });
  });

  it('create stamps the tenant and ignores a tenantId in the payload', async () => {
    const created = await serviceA.create({ ...own, ...({ tenantId: b.id } as object) });
    const [row] = await testDb
      .select()
      .from(unitsOfMeasure)
      .where(eq(unitsOfMeasure.id, created.id));
    expect(row!.tenantId).toBe(a.id);
  });

  it('update, disable and enable cannot touch another tenant row', async () => {
    await expect(serviceA.update(unitB, { ...own, name: 'Hack' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      cause: { code: 'UNIT_NOT_FOUND' },
    });
    expect(await repoA.updateById(unitB, { ...own, name: 'Hack' })).toBeUndefined();
    await expect(serviceA.disable(unitB)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await repoA.setActive(unitB, false)).toBeUndefined();
    const [row] = await testDb.select().from(unitsOfMeasure).where(eq(unitsOfMeasure.id, unitB));
    expect(row).toMatchObject({ name: 'Bandeja', isActive: true });
  });
});
