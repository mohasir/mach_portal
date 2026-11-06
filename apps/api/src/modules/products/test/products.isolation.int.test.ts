import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { options, optionGroups, productPriceTiers, products } from '../../../db/schema';
import { seedTwoTenants, resetDb, testDb, type TestTenant } from '../../../test/db';
import { ProductsRepository } from '../products.repository';
import { ProductsService } from '../products.service';

type Seeded = { productId: string; groupId: string; optionId: string };

async function seedCatalog(tenant: TestTenant, name: string): Promise<Seeded> {
  const [product] = await testDb
    .insert(products)
    .values({ tenantId: tenant.id, name })
    .returning({ id: products.id });
  await testDb.insert(productPriceTiers).values({
    tenantId: tenant.id,
    productId: product!.id,
    numPersons: 10,
    price: 1000,
  });
  const [group] = await testDb
    .insert(optionGroups)
    .values({ tenantId: tenant.id, productId: product!.id, label: `${name} group` })
    .returning({ id: optionGroups.id });
  const [option] = await testDb
    .insert(options)
    .values({ tenantId: tenant.id, optionGroupId: group!.id, name: `${name} option` })
    .returning({ id: options.id });
  return { productId: product!.id, groupId: group!.id, optionId: option!.id };
}

describe('products tenant isolation', () => {
  let a: TestTenant;
  let b: TestTenant;
  let repoA: ProductsRepository;
  let repoB: ProductsRepository;
  let sa: Seeded;
  let sb: Seeded;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    sa = await seedCatalog(a, 'Menu A');
    sb = await seedCatalog(b, 'Menu B');
    repoA = new ProductsRepository(testDb, a.id);
    repoB = new ProductsRepository(testDb, b.id);
  });

  it('renaming a product to a name taken in the tenant is a CONFLICT, not a 500', async () => {
    const other = await seedCatalog(a, 'Other');
    const service = new ProductsService(repoA);
    const tiers = [{ numPersons: 10, price: 1000 }];
    await expect(
      service.updateProduct(other.productId, { name: 'Menu A', isPremium: false, tiers }),
    ).rejects.toMatchObject({ code: 'CONFLICT', cause: { code: 'PRODUCT_ALREADY_EXISTS' } });
    await expect(
      service.updateProduct(other.productId, { name: 'Menu B', isPremium: false, tiers }),
    ).resolves.toMatchObject({ name: 'Menu B' });
  });

  it('findTree returns only the tenant products, tiers, groups and options', async () => {
    const tree = await repoA.findTree(true);
    expect(tree.productRows.map((p) => p.id)).toEqual([sa.productId]);
    expect(tree.tierRows.map((t) => t.productId)).toEqual([sa.productId]);
    expect(tree.groupRows.map((g) => g.id)).toEqual([sa.groupId]);
    expect(tree.optionRows.map((o) => o.id)).toEqual([sa.optionId]);
  });

  it('findTree without inactive rows is still tenant scoped', async () => {
    const tree = await repoB.findTree(false);
    expect(tree.productRows.map((p) => p.id)).toEqual([sb.productId]);
    expect(tree.groupRows.map((g) => g.id)).toEqual([sb.groupId]);
    expect(tree.optionRows.map((o) => o.id)).toEqual([sb.optionId]);
  });

  it('findPricesTree returns only the tenant products and tiers', async () => {
    const tree = await repoA.findPricesTree();
    expect(tree.productRows.map((p) => p.id)).toEqual([sa.productId]);
    expect(tree.tierRows.map((t) => t.productId)).toEqual([sa.productId]);
  });

  it('findProductByName does not see another tenant product', async () => {
    expect(await repoA.findProductByName('Menu B')).toBeUndefined();
    expect((await repoA.findProductByName('Menu A'))?.id).toBe(sa.productId);
  });

  it('createProduct stamps tenant on product and tiers; same name in both tenants works', async () => {
    const created = await repoA.createProduct({
      name: 'Menu B',
      isPremium: false,
      tiers: [{ numPersons: 5, price: 500 }],
    });
    const [row] = await testDb.select().from(products).where(eq(products.id, created.id));
    expect(row?.tenantId).toBe(a.id);
    const tiers = await testDb
      .select()
      .from(productPriceTiers)
      .where(eq(productPriceTiers.productId, created.id));
    expect(tiers).toHaveLength(1);
    expect(tiers[0]?.tenantId).toBe(a.id);
  });

  it('createProduct with a duplicate name inside one tenant is rejected by the DB', async () => {
    await expect(
      repoA.createProduct({ name: 'Menu A', isPremium: false, tiers: [] }),
    ).rejects.toThrow();
  });

  it('updateProduct cannot modify another tenant product nor replace its tiers', async () => {
    const res = await repoA.updateProduct(sb.productId, {
      name: 'Hacked',
      isPremium: false,
      tiers: [{ numPersons: 99, price: 1 }],
    });
    expect(res).toBeUndefined();
    const [row] = await testDb.select().from(products).where(eq(products.id, sb.productId));
    expect(row?.name).toBe('Menu B');
    const tiers = await testDb
      .select()
      .from(productPriceTiers)
      .where(eq(productPriceTiers.productId, sb.productId));
    expect(tiers.map((t) => t.numPersons)).toEqual([10]);
  });

  it('updateProduct on own product replaces tiers stamped with the tenant', async () => {
    await repoA.updateProduct(sa.productId, {
      name: 'Menu A',
      isPremium: false,
      tiers: [{ numPersons: 20, price: 2000 }],
    });
    const tiers = await testDb
      .select()
      .from(productPriceTiers)
      .where(eq(productPriceTiers.productId, sa.productId));
    expect(tiers.map((t) => [t.numPersons, t.tenantId])).toEqual([[20, a.id]]);
  });

  it('updateTiers cannot touch another tenant product tiers', async () => {
    expect(await repoA.updateTiers(sb.productId, [{ numPersons: 7, price: 7 }])).toBeUndefined();
    const tiers = await testDb
      .select()
      .from(productPriceTiers)
      .where(eq(productPriceTiers.productId, sb.productId));
    expect(tiers.map((t) => t.numPersons)).toEqual([10]);
  });

  it('updateTiers returns only the tenant tiers', async () => {
    const res = await repoA.updateTiers(sa.productId, [{ numPersons: 3, price: 3 }]);
    expect(res?.tierRows.map((t) => t.numPersons)).toEqual([3]);
  });

  it('setProductActive cannot toggle another tenant product', async () => {
    expect(await repoA.setProductActive(sb.productId, false)).toBeUndefined();
    const [row] = await testDb.select().from(products).where(eq(products.id, sb.productId));
    expect(row?.isActive).toBe(true);
    expect((await repoA.setProductActive(sa.productId, false))?.isActive).toBe(false);
  });

  it('reorderProducts only affects the tenant rows', async () => {
    await testDb.update(products).set({ sortOrder: 5 }).where(eq(products.id, sb.productId));
    await repoA.reorderProducts([sb.productId, sa.productId]);
    const [rowB] = await testDb.select().from(products).where(eq(products.id, sb.productId));
    const [rowA] = await testDb.select().from(products).where(eq(products.id, sa.productId));
    expect(rowB?.sortOrder).toBe(5);
    expect(rowA?.sortOrder).toBe(1);
  });

  it('createOptionGroup rejects a product of another tenant and stamps the tenant otherwise', async () => {
    const input = { label: 'G', selectionType: 'select' as const };
    expect(await repoA.createOptionGroup({ ...input, productId: sb.productId })).toBeUndefined();
    const groupsB = await testDb
      .select()
      .from(optionGroups)
      .where(eq(optionGroups.productId, sb.productId));
    expect(groupsB).toHaveLength(1);
    const created = await repoA.createOptionGroup({ ...input, productId: sa.productId });
    const [row] = await testDb.select().from(optionGroups).where(eq(optionGroups.id, created!.id));
    expect(row?.tenantId).toBe(a.id);
  });

  it('updateOptionGroup and setOptionGroupActive cannot touch another tenant group', async () => {
    expect(
      await repoA.updateOptionGroup(sb.groupId, { label: 'Hacked', selectionType: 'select' }),
    ).toBeUndefined();
    expect(await repoA.setOptionGroupActive(sb.groupId, false)).toBeUndefined();
    const [row] = await testDb.select().from(optionGroups).where(eq(optionGroups.id, sb.groupId));
    expect(row?.label).toBe('Menu B group');
    expect(row?.isActive).toBe(true);
    expect((await repoA.setOptionGroupActive(sa.groupId, false))?.isActive).toBe(false);
  });

  it('reorderOptionGroups only affects the tenant rows', async () => {
    await testDb.update(optionGroups).set({ sortOrder: 5 }).where(eq(optionGroups.id, sb.groupId));
    await testDb.update(optionGroups).set({ sortOrder: 7 }).where(eq(optionGroups.id, sa.groupId));
    await repoA.reorderOptionGroups([sb.groupId, sa.groupId]);
    const [rowB] = await testDb.select().from(optionGroups).where(eq(optionGroups.id, sb.groupId));
    const [rowA] = await testDb.select().from(optionGroups).where(eq(optionGroups.id, sa.groupId));
    expect(rowB?.sortOrder).toBe(5);
    expect(rowA?.sortOrder).toBe(1);
  });

  it('createOption rejects a group of another tenant and stamps the tenant otherwise', async () => {
    expect(await repoA.createOption({ optionGroupId: sb.groupId, name: 'X' })).toBeUndefined();
    const optsB = await testDb.select().from(options).where(eq(options.optionGroupId, sb.groupId));
    expect(optsB).toHaveLength(1);
    const created = await repoA.createOption({ optionGroupId: sa.groupId, name: 'X' });
    const [row] = await testDb.select().from(options).where(eq(options.id, created!.id));
    expect(row?.tenantId).toBe(a.id);
  });

  it('updateOption and setOptionActive cannot touch another tenant option', async () => {
    expect(await repoA.updateOption(sb.optionId, { name: 'Hacked' })).toBeUndefined();
    expect(await repoA.setOptionActive(sb.optionId, false)).toBeUndefined();
    const [row] = await testDb.select().from(options).where(eq(options.id, sb.optionId));
    expect(row?.name).toBe('Menu B option');
    expect(row?.isActive).toBe(true);
    expect((await repoA.setOptionActive(sa.optionId, false))?.isActive).toBe(false);
  });

  it('reorderOptions only affects the tenant rows', async () => {
    await testDb.update(options).set({ sortOrder: 5 }).where(eq(options.id, sb.optionId));
    await testDb.update(options).set({ sortOrder: 7 }).where(eq(options.id, sa.optionId));
    await repoA.reorderOptions([sb.optionId, sa.optionId]);
    const [rowB] = await testDb.select().from(options).where(eq(options.id, sb.optionId));
    const [rowA] = await testDb.select().from(options).where(eq(options.id, sa.optionId));
    expect(rowB?.sortOrder).toBe(5);
    expect(rowA?.sortOrder).toBe(1);
  });

  it('tier reads and replacements ignore a stray tier of another tenant on the same product', async () => {
    // Deliberately inconsistent row: B tier pointing at A's product.
    await testDb
      .insert(productPriceTiers)
      .values({ tenantId: b.id, productId: sa.productId, numPersons: 50, price: 5 });
    expect((await repoA.findTree(true)).tierRows.map((t) => t.numPersons)).toEqual([10]);
    expect((await repoA.findPricesTree()).tierRows.map((t) => t.numPersons)).toEqual([10]);
    const res = await repoA.updateTiers(sa.productId, [{ numPersons: 3, price: 3 }]);
    expect(res?.tierRows.map((t) => t.numPersons)).toEqual([3]);
    const strays = await testDb
      .select()
      .from(productPriceTiers)
      .where(eq(productPriceTiers.tenantId, b.id));
    expect(strays.map((t) => t.numPersons).sort()).toEqual([10, 50]);
  });
});
