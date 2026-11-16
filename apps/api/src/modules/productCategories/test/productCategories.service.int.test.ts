import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { productCategoriesListQuerySchema } from '@repo/schemas';
import { productCategories, products } from '../../../db/schema';
import { resetDb, seedTwoTenants, testDb, testUnitId, type TestTenant } from '../../../test/db';
import { ProductCategoriesRepository } from '../productCategories.repository';
import { ProductCategoriesService } from '../productCategories.service';

const listAll = productCategoriesListQuerySchema.parse({});
const nameTaken = { code: 'CONFLICT', cause: { code: 'PRODUCT_CATEGORY_NAME_TAKEN' } };
const inUse = { code: 'CONFLICT', cause: { code: 'PRODUCT_CATEGORY_IN_USE' } };

describe('product categories', () => {
  let a: TestTenant;
  let b: TestTenant;
  let service: ProductCategoriesService;
  let serviceB: ProductCategoriesService;

  const productIn = async (categoryId: string, isActive = true) =>
    testDb.insert(products).values({
      tenantId: a.id,
      name: `P ${Math.random()}`,
      uomId: await testUnitId(a.id),
      categoryId,
      isActive,
    });

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    service = new ProductCategoriesService(new ProductCategoriesRepository(testDb, a.id));
    serviceB = new ProductCategoriesService(new ProductCategoriesRepository(testDb, b.id));
  });

  it('creates categories at the end of the list, active and unused', async () => {
    await service.create({ name: 'Bebidas' });
    const created = await service.create({ name: 'Postres' });
    expect(created).toMatchObject({
      name: 'Postres',
      isActive: true,
      sortOrder: 1,
      productCount: 0,
    });
    const { items } = await service.list(listAll);
    expect(items.map((c) => c.name)).toEqual(['Bebidas', 'Postres']);
  });

  it('keeps the name unique per organization regardless of case', async () => {
    const drinks = await service.create({ name: 'Bebidas' });
    await expect(service.create({ name: 'bebidas' })).rejects.toMatchObject(nameTaken);
    const desserts = await service.create({ name: 'Postres' });
    await expect(service.update(desserts.id, { name: 'BEBIDAS' })).rejects.toMatchObject(nameTaken);
    await expect(service.update(drinks.id, { name: 'bebidas' })).resolves.toMatchObject({
      name: 'bebidas',
    });
    await expect(serviceB.create({ name: 'Bebidas' })).resolves.toMatchObject({ name: 'Bebidas' });
  });

  it('rejects a duplicate name at the database too', async () => {
    await service.create({ name: 'Bebidas' });
    await expect(
      testDb.insert(productCategories).values({ tenantId: a.id, name: 'BEBIDAS' }),
    ).rejects.toThrow();
  });

  it('counts the products of each category', async () => {
    const drinks = await service.create({ name: 'Bebidas' });
    await productIn(drinks.id);
    await productIn(drinks.id, false);
    const { items } = await service.list(listAll);
    expect(items[0]).toMatchObject({ productCount: 2 });
  });

  it('disables a category with products, which keep it, and enables it again', async () => {
    const drinks = await service.create({ name: 'Bebidas' });
    await productIn(drinks.id);
    await expect(service.disable(drinks.id)).resolves.toMatchObject({ isActive: false });
    const [product] = await testDb.select().from(products).where(eq(products.tenantId, a.id));
    expect(product!.categoryId).toBe(drinks.id);
    await expect(service.enable(drinks.id)).resolves.toMatchObject({ isActive: true });
  });

  it('lists only active categories as options', async () => {
    const drinks = await service.create({ name: 'Bebidas' });
    await service.create({ name: 'Postres' });
    await service.disable(drinks.id);
    expect((await service.options()).map((c) => c.name)).toEqual(['Postres']);
  });

  it('filters the list by status and searches by name', async () => {
    const drinks = await service.create({ name: 'Bebidas' });
    await service.create({ name: 'Postres' });
    await service.disable(drinks.id);
    const inactive = await service.list(
      productCategoriesListQuerySchema.parse({ isActive: false }),
    );
    expect(inactive.items.map((c) => c.name)).toEqual(['Bebidas']);
    const found = await service.list(productCategoriesListQuerySchema.parse({ search: 'post' }));
    expect(found.items.map((c) => c.name)).toEqual(['Postres']);
  });

  it('deletes a category without products', async () => {
    const drinks = await service.create({ name: 'Bebidas' });
    await expect(service.remove(drinks.id)).resolves.toEqual({ id: drinks.id });
    expect(await testDb.select().from(productCategories)).toEqual([]);
  });

  it('refuses to delete a category with products, active or not', async () => {
    const drinks = await service.create({ name: 'Bebidas' });
    await productIn(drinks.id, false);
    await expect(service.remove(drinks.id)).rejects.toMatchObject(inUse);
    expect(await testDb.select().from(productCategories)).toHaveLength(1);
  });

  it('answers NOT_FOUND for unknown ids', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    const notFound = { code: 'NOT_FOUND', cause: { code: 'PRODUCT_CATEGORY_NOT_FOUND' } };
    await expect(service.update(missing, { name: 'X' })).rejects.toMatchObject(notFound);
    await expect(service.disable(missing)).rejects.toMatchObject(notFound);
    await expect(service.enable(missing)).rejects.toMatchObject(notFound);
    await expect(service.remove(missing)).rejects.toMatchObject(notFound);
  });
});
