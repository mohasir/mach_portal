import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProductSchema } from '@repo/schemas';
import { appSettings, products } from '../../../db/schema';
import { resetDb, seedTwoTenants, testDb, testUnitId, type TestTenant } from '../../../test/db';
import { ProductsRepository } from '../products.repository';
import { ProductsService } from '../products.service';

describe('product tax rate and exemption', () => {
  let a: TestTenant;
  let b: TestTenant;
  let service: ProductsService;
  let serviceB: ProductsService;
  let unitA: string;

  const base = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    isPremium: false,
    tiers: [],
    uomId: unitA,
    ...extra,
  });

  const stored = async (id: string) =>
    (
      await testDb
        .select({ taxRate: products.taxRate, taxExempt: products.taxExempt })
        .from(products)
        .where(eq(products.id, id))
    )[0];

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    service = new ProductsService(new ProductsRepository(testDb, a.id), true);
    serviceB = new ProductsService(new ProductsRepository(testDb, b.id), true);
    unitA = await testUnitId(a.id);
    await testDb.insert(appSettings).values([
      { tenantId: a.id, defaultTaxRate: 0.08875 },
      { tenantId: b.id, defaultTaxRate: 0.16 },
    ]);
  });

  it('takes the default rate of its own organization when created without one', async () => {
    const created = await service.createProduct(base('Bar'));
    expect(created).toMatchObject({ taxRate: 0.08875, taxExempt: false });
    expect(await stored(created.id)).toEqual({ taxRate: 0.08875, taxExempt: false });
  });

  it('takes 0 when the organization has no settings yet', async () => {
    await testDb.delete(appSettings).where(eq(appSettings.tenantId, a.id));
    const created = await service.createProduct(base('Bar'));
    expect(created.taxRate).toBe(0);
  });

  it('stores the rate and the exemption given on create', async () => {
    const created = await service.createProduct(base('Bar', { taxRate: 0.07, taxExempt: true }));
    expect(created).toMatchObject({ taxRate: 0.07, taxExempt: true });
  });

  it('updates the rate and the exemption, and keeps them when omitted', async () => {
    const { id } = await service.createProduct(base('Bar'));
    await expect(
      service.updateProduct(id, base('Bar', { taxRate: 0.05, taxExempt: true })),
    ).resolves.toMatchObject({ taxRate: 0.05, taxExempt: true });
    await expect(service.updateProduct(id, base('Bar'))).resolves.toMatchObject({
      taxRate: 0.05,
      taxExempt: true,
    });
  });

  it('copies the rate and the exemption when duplicating', async () => {
    const { id } = await service.createProduct(base('Bar', { taxRate: 0.0635, taxExempt: true }));
    const copy = await service.duplicateProduct(id);
    expect(copy).toMatchObject({ taxRate: 0.0635, taxExempt: true });
  });

  it('lists the rate and the exemption in the catalog', async () => {
    await service.createProduct(base('Bar', { taxRate: 0.07 }));
    const [product] = await service.catalog(true);
    expect(product).toMatchObject({ taxRate: 0.07, taxExempt: false });
  });

  it('never reads the default rate of another organization', async () => {
    const created = await serviceB.createProduct({
      ...base('Bar'),
      uomId: await testUnitId(b.id),
    });
    expect(created.taxRate).toBe(0.16);
    await expect(service.updateProduct(created.id, base('Bar'))).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(await stored(created.id)).toEqual({ taxRate: 0.16, taxExempt: false });
  });

  it('rejects a rate outside 0..1', () => {
    expect(createProductSchema.safeParse(base('Bar', { taxRate: 1.5 })).success).toBe(false);
    expect(createProductSchema.safeParse(base('Bar', { taxRate: -0.1 })).success).toBe(false);
  });
});
