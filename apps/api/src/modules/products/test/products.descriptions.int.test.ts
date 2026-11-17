import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProductSchema, LONG_DESCRIPTION_MAX, SHORT_DESCRIPTION_MAX } from '@repo/schemas';
import { products } from '../../../db/schema';
import { resetDb, seedTwoTenants, testDb, testUnitId, type TestTenant } from '../../../test/db';
import { ProductsRepository } from '../products.repository';
import { ProductsService } from '../products.service';

describe('product short and long descriptions', () => {
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
        .select({ short: products.shortDescription, long: products.longDescription })
        .from(products)
        .where(eq(products.id, id))
    )[0];

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    service = new ProductsService(new ProductsRepository(testDb, a.id), true, {
      read: true,
      update: true,
    });
    serviceB = new ProductsService(new ProductsRepository(testDb, b.id), true, {
      read: true,
      update: true,
    });
    unitA = await testUnitId(a.id);
  });

  it('creates with both descriptions and reads them back, never as description', async () => {
    const created = await service.createProduct(
      base('Bar', { shortDescription: 'Corta', longDescription: '# Larga\n\n- uno' }),
    );
    expect(created).toMatchObject({
      shortDescription: 'Corta',
      longDescription: '# Larga\n\n- uno',
    });
    expect(created).not.toHaveProperty('description');
    expect(await stored(created.id)).toEqual({ short: 'Corta', long: '# Larga\n\n- uno' });
    for (const list of [await service.list(), await service.catalog(true)]) {
      const found = list.find((p) => p.id === created.id);
      expect(found).toMatchObject({
        shortDescription: 'Corta',
        longDescription: '# Larga\n\n- uno',
      });
      expect(found).not.toHaveProperty('description');
    }
  });

  it('stores NULL for empty or whitespace-only text', async () => {
    const parsed = createProductSchema.parse({
      ...base('Bar'),
      shortDescription: '',
      longDescription: '   \n ',
    });
    const created = await service.createProduct(parsed);
    expect(await stored(created.id)).toEqual({ short: null, long: null });
  });

  it('stores NULL when omitted', async () => {
    const created = await service.createProduct(base('Bar'));
    expect(await stored(created.id)).toEqual({ short: null, long: null });
  });

  it('enforces the limits in the schema', () => {
    const parse = (extra: Record<string, unknown>) =>
      createProductSchema.safeParse({ ...base('Bar'), ...extra }).success;
    expect(parse({ shortDescription: 'x'.repeat(SHORT_DESCRIPTION_MAX) })).toBe(true);
    expect(parse({ shortDescription: 'x'.repeat(SHORT_DESCRIPTION_MAX + 1) })).toBe(false);
    expect(parse({ longDescription: 'x'.repeat(LONG_DESCRIPTION_MAX) })).toBe(true);
    expect(parse({ longDescription: 'x'.repeat(LONG_DESCRIPTION_MAX + 1) })).toBe(false);
  });

  it('updates and clears both descriptions', async () => {
    const { id } = await service.createProduct(
      base('Bar', { shortDescription: 'a', longDescription: 'b' }),
    );
    await service.updateProduct(id, base('Bar', { shortDescription: 'c', longDescription: 'd' }));
    expect(await stored(id)).toEqual({ short: 'c', long: 'd' });
    await service.updateProduct(id, base('Bar', { shortDescription: null, longDescription: null }));
    expect(await stored(id)).toEqual({ short: null, long: null });
  });

  it('keeps both descriptions when duplicating', async () => {
    const { id } = await service.createProduct(
      base('Bar', { shortDescription: 'a', longDescription: 'b' }),
    );
    const copy = await service.duplicateProduct(id);
    expect(copy).toMatchObject({ shortDescription: 'a', longDescription: 'b' });
    expect(await stored(copy.id)).toEqual({ short: 'a', long: 'b' });
  });

  it('does not expose or modify them from another organization', async () => {
    const { id } = await service.createProduct(
      base('Bar', { shortDescription: 'a', longDescription: 'b' }),
    );
    expect(JSON.stringify(await serviceB.list())).not.toContain('"b"');
    await expect(
      serviceB.updateProduct(id, {
        ...base('Bar'),
        uomId: await testUnitId(b.id),
        shortDescription: 'x',
      }),
    ).rejects.toBeTruthy();
    expect(await stored(id)).toEqual({ short: 'a', long: 'b' });
  });

  it('still omits the cost without the read permission', async () => {
    const limited = new ProductsService(new ProductsRepository(testDb, a.id), true, {
      read: false,
      update: true,
    });
    const created = await limited.createProduct(base('Bar', { shortDescription: 'a' }));
    expect(created).toMatchObject({ shortDescription: 'a' });
    expect(JSON.stringify(created)).not.toContain('"cost"');
  });
});
