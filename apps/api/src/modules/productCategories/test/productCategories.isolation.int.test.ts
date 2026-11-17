import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { productCategoriesListQuerySchema } from '@repo/schemas';
import { productCategories, products } from '../../../db/schema';
import { resetDb, seedTwoTenants, testDb, testUnitId, type TestTenant } from '../../../test/db';
import { ProductCategoriesRepository } from '../productCategories.repository';
import { ProductCategoriesService } from '../productCategories.service';

const listAll = productCategoriesListQuerySchema.parse({});
const notFound = { code: 'NOT_FOUND', cause: { code: 'PRODUCT_CATEGORY_NOT_FOUND' } };

describe('productCategories tenant isolation', () => {
  let a: TestTenant;
  let b: TestTenant;
  let repoA: ProductCategoriesRepository;
  let serviceA: ProductCategoriesService;
  let categoryB: string;

  const stored = async (id: string) =>
    (await testDb.select().from(productCategories).where(eq(productCategories.id, id)))[0];

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    repoA = new ProductCategoriesRepository(testDb, a.id);
    serviceA = new ProductCategoriesService(repoA);
    const serviceB = new ProductCategoriesService(new ProductCategoriesRepository(testDb, b.id));
    categoryB = (await serviceB.create({ name: 'Ajena' })).id;
  });

  it('findPaginated lists, searches and counts only the tenant rows', async () => {
    await serviceA.create({ name: 'Propia' });
    const res = await repoA.findPaginated(listAll);
    expect(res.items.map((c) => c.name)).toEqual(['Propia']);
    const searched = await repoA.findPaginated(
      productCategoriesListQuerySchema.parse({ search: 'Ajena', page: 1, pageSize: 5 }),
    );
    expect(searched).toMatchObject({ items: [], total: 0 });
  });

  it('options and findById never return another tenant category', async () => {
    expect(await serviceA.options()).toEqual([]);
    expect(await repoA.findById(categoryB)).toBeUndefined();
  });

  it('productCount and isUsed only count products of the tenant', async () => {
    const own = await serviceA.create({ name: 'Propia' });
    // A product of B pointing at A's category: corrupt cross-tenant data must not be counted.
    await testDb.insert(products).values({
      tenantId: b.id,
      name: 'Cruzado',
      taxRate: 0,
      uomId: await testUnitId(b.id),
      categoryId: own.id,
    });
    const { items } = await serviceA.list(listAll);
    expect(items[0]).toMatchObject({ productCount: 0 });
    expect(await repoA.isUsed(own.id)).toBe(false);
  });

  it('findByName does not see another tenant name', async () => {
    expect(await repoA.findByName('ajena')).toBeUndefined();
    await expect(serviceA.create({ name: 'Ajena' })).resolves.toMatchObject({ name: 'Ajena' });
  });

  it('cannot update, disable, enable or delete another tenant category', async () => {
    await expect(serviceA.update(categoryB, { name: 'Hack' })).rejects.toMatchObject(notFound);
    await expect(serviceA.disable(categoryB)).rejects.toMatchObject(notFound);
    await expect(serviceA.enable(categoryB)).rejects.toMatchObject(notFound);
    await expect(serviceA.remove(categoryB)).rejects.toMatchObject(notFound);
    expect(await stored(categoryB)).toMatchObject({ name: 'Ajena', isActive: true });
  });
});
