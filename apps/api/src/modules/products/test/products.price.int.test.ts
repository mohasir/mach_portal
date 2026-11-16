import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { products } from '../../../db/schema';
import { createTestTenant, resetDb, testDb } from '../../../test/db';
import { ProductsRepository } from '../products.repository';
import { ProductsService } from '../products.service';

describe('product price', () => {
  let tenantId: string;
  const serviceFor = (priceTiersActive: boolean) =>
    new ProductsService(new ProductsRepository(testDb, tenantId), priceTiersActive);
  const base = { name: 'Bar', isPremium: false, tiers: [] };

  beforeEach(async () => {
    await resetDb();
    tenantId = (await createTestTenant('price')).id;
  });

  it('creates with a price and reports it quotable without tiers or add-on', async () => {
    const created = await serviceFor(false).createProduct({ ...base, price: 500 });
    expect(created).toMatchObject({ price: 500, quotable: true });
  });

  it('creates without a price as not quotable', async () => {
    expect(await serviceFor(false).createProduct(base)).toMatchObject({
      price: null,
      quotable: false,
    });
  });

  it('keeps the price when omitted on update and clears it with null', async () => {
    const service = serviceFor(true);
    const { id } = await service.createProduct({ ...base, price: 500 });
    expect(await service.updateProduct(id, { ...base, name: 'Bar 2' })).toMatchObject({
      price: 500,
    });
    expect(await service.updateProduct(id, { ...base, price: null })).toMatchObject({
      price: null,
      quotable: false,
    });
    const [row] = await testDb.select().from(products).where(eq(products.id, id));
    expect(row!.price).toBeNull();
  });

  it('is quotable through stored tiers only while the add-on is active', async () => {
    const tiers = [{ quantity: 10, price: 1000 }];
    const { id } = await serviceFor(true).createProduct({ ...base, tiers });
    expect(await serviceFor(true).updateProduct(id, { ...base, tiers })).toMatchObject({
      quotable: true,
    });
    // With the add-on off the stored tiers are kept but no longer count.
    expect(await serviceFor(false).updateProduct(id, base)).toMatchObject({ quotable: false });
    const [product] = await serviceFor(false).catalog(true);
    expect(product!.quotable).toBe(false);
    expect(product!.priceTiers).toHaveLength(1);
  });

  it('duplicates the price', async () => {
    const service = serviceFor(true);
    const { id } = await service.createProduct({ ...base, price: 700 });
    expect(await service.duplicateProduct(id)).toMatchObject({ price: 700, quotable: true });
  });
});
