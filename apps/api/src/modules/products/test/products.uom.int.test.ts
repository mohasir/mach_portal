import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { products, unitsOfMeasure } from '../../../db/schema';
import { resetDb, seedTwoTenants, testDb, testUnitId, type TestTenant } from '../../../test/db';
import { ProductsRepository } from '../products.repository';
import { ProductsService } from '../products.service';

const unitNotFound = { code: 'NOT_FOUND', cause: { code: 'UNIT_NOT_FOUND' } };

describe('product unit of measure', () => {
  let a: TestTenant;
  let b: TestTenant;
  let service: ProductsService;
  let persA: string;
  let hourA: string;
  let persB: string;

  const base = (uomId: string) => ({ name: 'Bar', isPremium: false, tiers: [], uomId });

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    service = new ProductsService(new ProductsRepository(testDb, a.id), true);
    persA = await testUnitId(a.id, 'pers');
    hourA = await testUnitId(a.id, 'h');
    persB = await testUnitId(b.id, 'pers');
  });

  it('creates the product with its unit and returns the unit to format quantities', async () => {
    const created = await service.createProduct(base(hourA));
    expect(created).toMatchObject({
      uomId: hourA,
      unit: { id: hourA, name: 'Hora', pluralName: 'Horas', code: 'h' },
    });
  });

  it('rejects a unit of another organization on create, like an unknown one', async () => {
    await expect(service.createProduct(base(persB))).rejects.toMatchObject(unitNotFound);
    await expect(
      service.createProduct(base('00000000-0000-4000-8000-000000000000')),
    ).rejects.toMatchObject(unitNotFound);
    expect(await testDb.select().from(products).where(eq(products.tenantId, a.id))).toEqual([]);
  });

  it('rejects an inactive unit on create', async () => {
    await testDb
      .update(unitsOfMeasure)
      .set({ isActive: false })
      .where(eq(unitsOfMeasure.id, hourA));
    await expect(service.createProduct(base(hourA))).rejects.toMatchObject(unitNotFound);
  });

  it('changes the unit on update and rejects a unit of another organization', async () => {
    const { id } = await service.createProduct(base(persA));
    await expect(service.updateProduct(id, base(hourA))).resolves.toMatchObject({
      uomId: hourA,
      unit: { code: 'h' },
    });
    await expect(service.updateProduct(id, base(persB))).rejects.toMatchObject(unitNotFound);
    const [row] = await testDb.select().from(products).where(eq(products.id, id));
    expect(row!.uomId).toBe(hourA);
  });

  it('keeps an inactive unit the product already has, but does not switch to one', async () => {
    const { id } = await service.createProduct(base(persA));
    await testDb
      .update(unitsOfMeasure)
      .set({ isActive: false })
      .where(eq(unitsOfMeasure.id, persA));
    await expect(
      service.updateProduct(id, { ...base(persA), name: 'Bar 2' }),
    ).resolves.toMatchObject({ name: 'Bar 2', uomId: persA });
    await testDb
      .update(unitsOfMeasure)
      .set({ isActive: false })
      .where(eq(unitsOfMeasure.id, hourA));
    await expect(service.updateProduct(id, base(hourA))).rejects.toMatchObject(unitNotFound);
  });

  it('lists the unit in the product tree, the admin catalog and the prices list', async () => {
    await service.createProduct(base(hourA));
    const [listed] = await service.list();
    const [catalog] = await service.catalog(true);
    const [priced] = await service.pricesList();
    for (const product of [listed, catalog, priced]) {
      expect(product).toMatchObject({ uomId: hourA, unit: { code: 'h', pluralName: 'Horas' } });
    }
  });

  it('copies the unit when duplicating', async () => {
    const { id } = await service.createProduct(base(hourA));
    const copy = await service.duplicateProduct(id);
    expect(copy).toMatchObject({ uomId: hourA, unit: { code: 'h' } });
  });
});
