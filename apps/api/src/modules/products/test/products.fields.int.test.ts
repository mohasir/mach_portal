import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { productCategories, products } from '../../../db/schema';
import { resetDb, seedTwoTenants, testDb, testUnitId, type TestTenant } from '../../../test/db';
import { ProductsRepository } from '../products.repository';
import { ProductsService } from '../products.service';

const FULL_COST = { read: true, update: true };

describe('product SKU, category and minimum quantity', () => {
  let a: TestTenant;
  let b: TestTenant;
  let service: ProductsService;
  let serviceB: ProductsService;
  let unitA: string;
  let unitB: string;

  const base = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    isPremium: false,
    tiers: [],
    uomId: unitA,
    ...extra,
  });

  const category = async (tenantId: string, name: string, isActive = true) =>
    (
      await testDb
        .insert(productCategories)
        .values({ tenantId, name, isActive })
        .returning({ id: productCategories.id })
    )[0]!.id;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    service = new ProductsService(new ProductsRepository(testDb, a.id), true, FULL_COST);
    serviceB = new ProductsService(new ProductsRepository(testDb, b.id), true, FULL_COST);
    unitA = await testUnitId(a.id);
    unitB = await testUnitId(b.id);
  });

  describe('SKU', () => {
    it('stores a trimmed SKU and returns it', async () => {
      const created = await service.createProduct(base('Bar', { sku: 'AB-1' }));
      expect(created).toMatchObject({ sku: 'AB-1' });
    });

    it('is unique per organization regardless of case', async () => {
      await service.createProduct(base('Bar', { sku: 'AB-1' }));
      await expect(service.createProduct(base('Bar 2', { sku: 'ab-1' }))).rejects.toMatchObject({
        code: 'CONFLICT',
        cause: { code: 'PRODUCT_SKU_TAKEN' },
      });
      const other = await service.createProduct(base('Bar 3', { sku: 'AB-2' }));
      await expect(
        service.updateProduct(other.id, base('Bar 3', { sku: 'Ab-1' })),
      ).rejects.toMatchObject({ code: 'CONFLICT', cause: { code: 'PRODUCT_SKU_TAKEN' } });
    });

    it('lets another organization use the same SKU', async () => {
      await service.createProduct(base('Bar', { sku: 'AB-1' }));
      await expect(
        serviceB.createProduct({ ...base('Bar', { sku: 'AB-1' }), uomId: unitB }),
      ).resolves.toMatchObject({ sku: 'AB-1' });
    });

    it('can be repeated when empty', async () => {
      await service.createProduct(base('Bar'));
      await service.createProduct(base('Bar 2', { sku: null }));
      await expect(service.createProduct(base('Bar 3'))).resolves.toMatchObject({ sku: null });
    });

    it('rejects a duplicate at the database too', async () => {
      await service.createProduct(base('Bar', { sku: 'AB-1' }));
      await expect(
        testDb
          .insert(products)
          .values({ tenantId: a.id, name: 'Raw', taxRate: 0, uomId: unitA, sku: 'ab-1' }),
      ).rejects.toThrow();
    });

    it('keeps the SKU on update when omitted and clears it with null', async () => {
      const { id } = await service.createProduct(base('Bar', { sku: 'AB-1' }));
      await expect(service.updateProduct(id, base('Bar'))).resolves.toMatchObject({
        sku: 'AB-1',
      });
      await expect(service.updateProduct(id, base('Bar', { sku: null }))).resolves.toMatchObject({
        sku: null,
      });
    });

    it('lets a product keep its own SKU on update', async () => {
      const { id } = await service.createProduct(base('Bar', { sku: 'AB-1' }));
      await expect(service.updateProduct(id, base('Bar', { sku: 'ab-1' }))).resolves.toMatchObject({
        sku: 'ab-1',
      });
    });

    it('does not copy the SKU when duplicating', async () => {
      const { id } = await service.createProduct(base('Bar', { sku: 'AB-1' }));
      await expect(service.duplicateProduct(id)).resolves.toMatchObject({ sku: null });
    });
  });

  describe('category', () => {
    it('assigns a category of the organization and returns it', async () => {
      const drinks = await category(a.id, 'Bebidas');
      const created = await service.createProduct(base('Bar', { categoryId: drinks }));
      expect(created).toMatchObject({
        categoryId: drinks,
        category: { id: drinks, name: 'Bebidas' },
      });
      const [listed] = await service.catalog(true);
      expect(listed).toMatchObject({ categoryId: drinks, category: { name: 'Bebidas' } });
    });

    it('leaves a product without category', async () => {
      await expect(service.createProduct(base('Bar'))).resolves.toMatchObject({
        categoryId: null,
        category: null,
      });
    });

    it('rejects a category of another organization like an unknown one', async () => {
      const foreign = await category(b.id, 'Ajena');
      for (const categoryId of [foreign, '00000000-0000-4000-8000-000000000000']) {
        await expect(service.createProduct(base('Bar', { categoryId }))).rejects.toMatchObject({
          code: 'NOT_FOUND',
          cause: { code: 'PRODUCT_CATEGORY_NOT_FOUND' },
        });
      }
      expect(await testDb.select().from(products).where(eq(products.tenantId, a.id))).toEqual([]);
    });

    it('rejects an inactive category unless the product already has it', async () => {
      const drinks = await category(a.id, 'Bebidas');
      const old = await category(a.id, 'Vieja', false);
      await expect(service.createProduct(base('Bar', { categoryId: old }))).rejects.toMatchObject({
        cause: { code: 'PRODUCT_CATEGORY_NOT_FOUND' },
      });
      const { id } = await service.createProduct(base('Bar', { categoryId: drinks }));
      await testDb
        .update(productCategories)
        .set({ isActive: false })
        .where(eq(productCategories.id, drinks));
      await expect(
        service.updateProduct(id, base('Bar 2', { categoryId: drinks })),
      ).resolves.toMatchObject({ name: 'Bar 2', categoryId: drinks });
      await expect(
        service.updateProduct(id, base('Bar 2', { categoryId: old })),
      ).rejects.toMatchObject({ cause: { code: 'PRODUCT_CATEGORY_NOT_FOUND' } });
    });

    it('keeps the category on update when omitted and clears it with null', async () => {
      const drinks = await category(a.id, 'Bebidas');
      const { id } = await service.createProduct(base('Bar', { categoryId: drinks }));
      await expect(service.updateProduct(id, base('Bar'))).resolves.toMatchObject({
        categoryId: drinks,
      });
      await expect(
        service.updateProduct(id, base('Bar', { categoryId: null })),
      ).resolves.toMatchObject({ categoryId: null });
    });

    it('copies the category when duplicating', async () => {
      const drinks = await category(a.id, 'Bebidas');
      const { id } = await service.createProduct(base('Bar', { categoryId: drinks }));
      await expect(service.duplicateProduct(id)).resolves.toMatchObject({ categoryId: drinks });
    });

    it('restricts deleting a category that has products', async () => {
      const drinks = await category(a.id, 'Bebidas');
      await service.createProduct(base('Bar', { categoryId: drinks }));
      await expect(
        testDb.delete(productCategories).where(eq(productCategories.id, drinks)),
      ).rejects.toThrow();
    });
  });

  describe('minimum quantity', () => {
    it('defaults to 1 and stores the given value', async () => {
      await expect(service.createProduct(base('Bar'))).resolves.toMatchObject({ minQuantity: 1 });
      const created = await service.createProduct(base('Bar 2', { minQuantity: 25 }));
      expect(created).toMatchObject({ minQuantity: 25 });
      const [listed] = (await service.list()).filter((p) => p.id === created.id);
      expect(listed).toMatchObject({ minQuantity: 25 });
    });

    it('keeps it on update when omitted and copies it when duplicating', async () => {
      const { id } = await service.createProduct(base('Bar', { minQuantity: 25 }));
      await expect(service.updateProduct(id, base('Bar'))).resolves.toMatchObject({
        minQuantity: 25,
      });
      await expect(service.duplicateProduct(id)).resolves.toMatchObject({ minQuantity: 25 });
    });

    it('marks a product not quotable when no tier reaches its minimum and it has no price', async () => {
      const tiers = [
        { quantity: 10, price: 100 },
        { quantity: 20, price: 200 },
      ];
      const low = await service.createProduct(base('Bar', { tiers, minQuantity: 20 }));
      expect(low.quotable).toBe(true);
      const high = await service.updateProduct(low.id, base('Bar', { tiers, minQuantity: 21 }));
      expect(high.quotable).toBe(false);
      const [listed] = await service.catalog(true);
      expect(listed).toMatchObject({ minQuantity: 21, quotable: false });
    });

    it('is at least 1 at the database', async () => {
      await expect(
        testDb
          .insert(products)
          .values({ tenantId: a.id, name: 'Raw', taxRate: 0, uomId: unitA, minQuantity: 0 }),
      ).rejects.toThrow();
    });
  });
});
