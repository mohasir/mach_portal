import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PRODUCT_IMAGES_MAX } from '@repo/schemas';
import { withTenantTx } from '../../../db';
import { productImages, products } from '../../../db/schema';
import { settleBackgroundTasks } from '../../../lib/background';
import {
  ALL_TOGGLEABLE_FEATURES,
  addMember,
  addMemberWithGrants,
  createTestUser,
  resetDb,
  seedTwoTenants,
  testDb,
  testUnitId,
  type TestTenant,
} from '../../../test/db';
import { callerFor } from '../../../test/trpcCaller';
import { ProductImagesRepository } from '../products.images.repository';
import { ProductImageUploader } from '../products.images.service';

const storage = vi.hoisted(() => ({
  upload: vi.fn(async ({ key }: { key: string }) => ({ key, url: `http://r2/${key}` })),
  delete: vi.fn(async () => undefined),
}));
vi.mock('../../../lib/storage', () => ({ getStorageProvider: () => storage }));

let png: Buffer;
beforeAll(async () => {
  png = await sharp({
    create: { width: 640, height: 480, channels: 3, background: { r: 10, g: 120, b: 200 } },
  })
    .png()
    .toBuffer();
});

const file = (name = 'photo.png') => ({ buffer: png, originalname: name });

const uploaderFor = (tenantId: string, galleryEnabled = true) =>
  new ProductImageUploader(
    (fn) => withTenantTx(tenantId, fn, testDb),
    (tx) => new ProductImagesRepository(tx, tenantId),
    tenantId,
    galleryEnabled,
  );

const imagesOf = (productId: string) =>
  testDb
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(productImages.sortOrder);

const insertProduct = async (tenantId: string, name: string) =>
  (
    await testDb
      .insert(products)
      .values({ tenantId, name, taxRate: 0, uomId: await testUnitId(tenantId), price: 100 })
      .returning({ id: products.id })
  )[0]!.id;

describe('product images', () => {
  let a: TestTenant;
  let b: TestTenant;
  let productA: string;
  let productB: string;

  beforeEach(async () => {
    await resetDb();
    storage.upload.mockClear();
    storage.delete.mockClear();
    ({ a, b } = await seedTwoTenants());
    productA = await insertProduct(a.id, 'Bar A');
    productB = await insertProduct(b.id, 'Bar B');
  });
  afterEach(() => vi.restoreAllMocks());

  const upload = (tenant: TestTenant, productId: string, name?: string) =>
    uploaderFor(tenant.id).add(productId, file(name), tenant.userId);

  describe('upload', () => {
    it('stores a WebP image and thumbnail under the tenant and product prefix', async () => {
      const image = await upload(a, productA);

      expect(storage.upload).toHaveBeenCalledTimes(2);
      const [main, thumb] = storage.upload.mock.calls.map(([params]) => params);
      const prefix = `t/${a.id}/products/${productA}/`;
      expect(main!.key.startsWith(prefix)).toBe(true);
      expect(thumb!.key.startsWith(prefix)).toBe(true);
      for (const params of [main!, thumb!]) {
        const { contentType, body } = params as unknown as { contentType: string; body: Buffer };
        expect(contentType).toBe('image/webp');
        expect((await sharp(body).metadata()).format).toBe('webp');
      }

      const [row] = await imagesOf(productA);
      expect(row).toMatchObject({
        tenantId: a.id,
        imageKey: main!.key,
        imageUrl: `http://r2/${main!.key}`,
        thumbKey: thumb!.key,
        thumbUrl: `http://r2/${thumb!.key}`,
        fileName: 'photo.png',
        width: 640,
        height: 480,
        sortOrder: 0,
        isFeatured: true,
        createdById: a.userId,
      });
      expect(image).toEqual({
        id: row!.id,
        imageUrl: row!.imageUrl,
        thumbUrl: row!.thumbUrl,
        isFeatured: true,
        sortOrder: 0,
      });
    });

    it('features only the first image and appends the next ones', async () => {
      await upload(a, productA, 'one.png');
      await upload(a, productA, 'two.png');
      const rows = await imagesOf(productA);
      expect(rows.map((r) => [r.fileName, r.sortOrder, r.isFeatured])).toEqual([
        ['one.png', 0, true],
        ['two.png', 1, false],
      ]);
    });

    it(`rejects the image after ${PRODUCT_IMAGES_MAX} before processing or uploading it`, async () => {
      for (let i = 0; i < PRODUCT_IMAGES_MAX; i++) await upload(a, productA);
      storage.upload.mockClear();
      await expect(upload(a, productA)).rejects.toMatchObject({
        code: 'PRODUCT_IMAGE_LIMIT_REACHED',
        status: 409,
      });
      expect(storage.upload).not.toHaveBeenCalled();
      expect(await imagesOf(productA)).toHaveLength(PRODUCT_IMAGES_MAX);
    });

    it('keeps the maximum with simultaneous uploads and cleans the files of the rejected ones', async () => {
      for (let i = 0; i < PRODUCT_IMAGES_MAX - 2; i++) await upload(a, productA);
      storage.upload.mockClear();

      // Every upload waits until all of them passed the first check, so the second check decides.
      const concurrent = 4;
      let release!: () => void;
      const allChecked = new Promise<void>((resolve) => (release = resolve));
      storage.upload.mockImplementation(async ({ key }: { key: string }) => {
        if (storage.upload.mock.calls.length === concurrent * 2) release();
        await allChecked;
        return { key, url: `http://r2/${key}` };
      });

      const results = await Promise.allSettled(
        Array.from({ length: concurrent }, () => upload(a, productA)),
      );
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
      expect(rejected).toHaveLength(2);
      for (const r of rejected) {
        expect((r as PromiseRejectedResult).reason).toMatchObject({
          code: 'PRODUCT_IMAGE_LIMIT_REACHED',
        });
      }

      const rows = await imagesOf(productA);
      expect(rows).toHaveLength(PRODUCT_IMAGES_MAX);
      expect(rows.filter((r) => r.isFeatured)).toHaveLength(1);
      const kept = new Set(rows.flatMap((r) => [r.imageKey, r.thumbKey]));
      const deleted = storage.delete.mock.calls.map((call) => (call as unknown as [string])[0]);
      expect(deleted).toHaveLength(4);
      for (const key of deleted) expect(kept.has(key)).toBe(false);
    });

    it('removes both files and keeps the original error when the row cannot be saved', async () => {
      vi.spyOn(ProductImagesRepository.prototype, 'insert').mockRejectedValueOnce(
        new Error('insert failed'),
      );
      await expect(upload(a, productA)).rejects.toThrow('insert failed');
      const keys = storage.upload.mock.calls.map(([params]) => params.key);
      expect(keys).toHaveLength(2);
      expect(
        storage.delete.mock.calls.map((call) => (call as unknown as [string])[0]).sort(),
      ).toEqual(keys.sort());
      expect(await imagesOf(productA)).toEqual([]);
    });

    it('removes the stored file when the other one fails to upload', async () => {
      storage.upload
        .mockImplementationOnce(async ({ key }: { key: string }) => ({
          key,
          url: `http://r2/${key}`,
        }))
        .mockRejectedValueOnce(new Error('r2 down'));
      await expect(upload(a, productA)).rejects.toThrow('r2 down');
      const stored = storage.upload.mock.calls[0]![0].key;
      expect(storage.delete).toHaveBeenCalledTimes(1);
      expect(storage.delete).toHaveBeenCalledWith(stored);
      expect(await imagesOf(productA)).toEqual([]);
    });

    it('rejects a file that is not an image without uploading anything', async () => {
      await expect(
        uploaderFor(a.id).add(
          productA,
          { buffer: Buffer.from('nope'), originalname: 'x.png' },
          null,
        ),
      ).rejects.toMatchObject({ code: 'PRODUCT_IMAGE_INVALID_IMAGE', status: 400 });
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it("answers PRODUCT_NOT_FOUND for another tenant's product and uploads nothing", async () => {
      await expect(upload(a, productB)).rejects.toMatchObject({
        code: 'PRODUCT_NOT_FOUND',
        status: 404,
      });
      expect(storage.upload).not.toHaveBeenCalled();
      expect(await imagesOf(productB)).toEqual([]);
    });
  });

  describe('tRPC mutations', () => {
    let adminA: { id: string };

    beforeEach(async () => {
      adminA = await createTestUser();
      await addMember(adminA.id, a.id, 'admin');
    });

    const seedImages = async (tenant: TestTenant, productId: string, n: number) => {
      for (let i = 0; i < n; i++) await upload(tenant, productId, `img-${i}.png`);
      return (await imagesOf(productId)).map((r) => r.id);
    };

    it('exposes the images on the product, featured flag and order included', async () => {
      const [first, second] = await seedImages(a, productA, 2);
      const catalog = await callerFor(a, adminA).products.catalog();
      const product = catalog.find((p) => p.id === productA)!;
      expect(product.images.map((i) => [i.id, i.isFeatured, i.sortOrder])).toEqual([
        [first, true, 0],
        [second, false, 1],
      ]);
      expect(product.images[0]).toEqual({
        id: first,
        imageUrl: expect.stringMatching(/^http:\/\/r2\/t\//),
        thumbUrl: expect.stringMatching(/-thumb\.webp$/),
        isFeatured: true,
        sortOrder: 0,
      });
      expect(product.images[0]).not.toHaveProperty('imageKey');
    });

    it('setFeatured moves the single featured mark', async () => {
      const [first, second] = await seedImages(a, productA, 2);
      const images = await callerFor(a, adminA).products.images.setFeatured({
        productId: productA,
        imageId: second!,
      });
      expect(images.map((i) => [i.id, i.isFeatured])).toEqual([
        [first, false],
        [second, true],
      ]);
    });

    it('the database allows one featured image per product', async () => {
      const [, second] = await seedImages(a, productA, 2);
      await expect(
        testDb.update(productImages).set({ isFeatured: true }).where(eq(productImages.id, second!)),
      ).rejects.toThrow();
    });

    it('setFeatured on an image of another product or tenant is IMAGE_NOT_FOUND and changes nothing', async () => {
      const [first] = await seedImages(a, productA, 1);
      const productA2 = await insertProduct(a.id, 'Bar A2');
      const [other] = await seedImages(a, productA2, 1);
      const [foreign] = await seedImages(b, productB, 1);
      const caller = callerFor(a, adminA);
      for (const imageId of [other!, foreign!]) {
        await expect(
          caller.products.images.setFeatured({ productId: productA, imageId }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND', cause: { code: 'PRODUCT_IMAGE_NOT_FOUND' } });
      }
      expect((await imagesOf(productA)).map((r) => [r.id, r.isFeatured])).toEqual([[first, true]]);
      expect((await imagesOf(productB))[0]!.isFeatured).toBe(true);
    });

    it('a product of another tenant is PRODUCT_NOT_FOUND for every image mutation', async () => {
      const [foreign] = await seedImages(b, productB, 1);
      const caller = callerFor(a, adminA);
      const notFound = { code: 'NOT_FOUND', cause: { code: 'PRODUCT_NOT_FOUND' } };
      await expect(
        caller.products.images.setFeatured({ productId: productB, imageId: foreign! }),
      ).rejects.toMatchObject(notFound);
      await expect(
        caller.products.images.reorder({ productId: productB, ids: [foreign!] }),
      ).rejects.toMatchObject(notFound);
      await expect(
        caller.products.images.delete({ productId: productB, imageId: foreign! }),
      ).rejects.toMatchObject(notFound);
      expect(await imagesOf(productB)).toHaveLength(1);
    });

    it('reorder writes the new order and needs every image exactly once', async () => {
      const [x, y, z] = await seedImages(a, productA, 3);
      const caller = callerFor(a, adminA);
      const images = await caller.products.images.reorder({
        productId: productA,
        ids: [z!, x!, y!],
      });
      expect(images.map((i) => i.id)).toEqual([z, x, y]);
      expect(images.find((i) => i.isFeatured)?.id).toBe(x);

      for (const ids of [
        [z!, x!],
        [z!, x!, x!],
        [z!, x!, y!, y!],
      ]) {
        await expect(
          caller.products.images.reorder({ productId: productA, ids }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND', cause: { code: 'PRODUCT_IMAGE_NOT_FOUND' } });
      }
      expect((await imagesOf(productA)).map((r) => r.id)).toEqual([z, x, y]);
    });

    it('deleting the featured image promotes the next one and removes its files after commit', async () => {
      const [first, second, third] = await seedImages(a, productA, 3);
      const [row] = (await imagesOf(productA)).filter((r) => r.id === first);
      const images = await callerFor(a, adminA).products.images.delete({
        productId: productA,
        imageId: first!,
      });
      expect(images.map((i) => [i.id, i.isFeatured])).toEqual([
        [second, true],
        [third, false],
      ]);
      await settleBackgroundTasks();
      expect(
        storage.delete.mock.calls.map((call) => (call as unknown as [string])[0]).sort(),
      ).toEqual([row!.imageKey, row!.thumbKey].sort());
    });

    it('deleting another image keeps the featured one', async () => {
      const [first, second] = await seedImages(a, productA, 2);
      const images = await callerFor(a, adminA).products.images.delete({
        productId: productA,
        imageId: second!,
      });
      expect(images.map((i) => [i.id, i.isFeatured])).toEqual([[first, true]]);
    });

    it('a deleted product takes its images along', async () => {
      await seedImages(a, productA, 2);
      await testDb.delete(products).where(eq(products.id, productA));
      expect(await imagesOf(productA)).toEqual([]);
    });

    it('requires product.update', async () => {
      const [first] = await seedImages(a, productA, 1);
      const reader = await createTestUser();
      await addMemberWithGrants(reader.id, a.id, [[RESOURCES.PRODUCT, ACTIONS.READ, 'all']]);
      const caller = callerFor(a, { id: reader.id });
      const forbidden = { code: 'FORBIDDEN' };
      await expect(
        caller.products.images.setFeatured({ productId: productA, imageId: first! }),
      ).rejects.toMatchObject(forbidden);
      await expect(
        caller.products.images.reorder({ productId: productA, ids: [first!] }),
      ).rejects.toMatchObject(forbidden);
      await expect(
        caller.products.images.delete({ productId: productA, imageId: first! }),
      ).rejects.toMatchObject(forbidden);
      expect(await imagesOf(productA)).toHaveLength(1);
      // Reading the catalog still shows the images.
      const catalog = await caller.products.catalog();
      expect(catalog.find((p) => p.id === productA)!.images).toHaveLength(1);
    });
  });

  describe('repository isolation', () => {
    let repoA: ProductImagesRepository;
    let imageB: string;

    beforeEach(async () => {
      repoA = new ProductImagesRepository(testDb, a.id);
      await upload(b, productB);
      imageB = (await imagesOf(productB))[0]!.id;
    });

    it('reads nothing of another tenant', async () => {
      expect(await repoA.findProduct(productB)).toBeUndefined();
      expect(
        await testDb.transaction((tx) =>
          new ProductImagesRepository(tx, a.id).lockProduct(productB),
        ),
      ).toBeUndefined();
      expect(await repoA.count(productB)).toBe(0);
      expect(await repoA.listByProduct(productB)).toEqual([]);
      expect((await repoA.listAll()).size).toBe(0);
    });

    it('writes nothing of another tenant', async () => {
      await testDb
        .update(productImages)
        .set({ sortOrder: 7, isFeatured: false })
        .where(eq(productImages.id, imageB));
      expect(await repoA.delete(productB, imageB)).toBeUndefined();
      expect(await repoA.setFeatured(productB, imageB)).toBeUndefined();
      await repoA.reorder(productB, [imageB]);
      await repoA.featureFirst(productB);
      expect((await imagesOf(productB)).map((r) => [r.id, r.sortOrder, r.isFeatured])).toEqual([
        [imageB, 7, false],
      ]);
    });

    it('inserts rows for its own tenant only', async () => {
      const row = await repoA.insert({
        productId: productA,
        imageKey: 'k',
        imageUrl: 'u',
        thumbKey: 'tk',
        thumbUrl: 'tu',
        fileName: 'f.png',
        size: 1,
        width: 1,
        height: 1,
        createdById: null,
      });
      const [stored] = await testDb
        .select({ tenantId: productImages.tenantId })
        .from(productImages)
        .where(eq(productImages.id, row.id));
      expect(stored).toEqual({ tenantId: a.id });
      // B's featured image does not count as A's: A's first image is featured too.
      expect(row.isFeatured).toBe(true);
    });
  });

  describe('without the productGallery add-on', () => {
    const single = (tenant: TestTenant, productId: string, name?: string) =>
      uploaderFor(tenant.id, false).add(productId, file(name), tenant.userId);

    it('replaces the only image and removes the old files', async () => {
      await single(a, productA, 'one.png');
      const [old] = await imagesOf(productA);
      await single(a, productA, 'two.png');
      const rows = await imagesOf(productA);
      expect(rows.map((r) => [r.fileName, r.isFeatured])).toEqual([['two.png', true]]);
      expect(
        storage.delete.mock.calls.map((call) => (call as unknown as [string])[0]).sort(),
      ).toEqual([old!.imageKey, old!.thumbKey].sort());
    });

    it('refuses an upload while several images from before remain', async () => {
      await upload(a, productA);
      await upload(a, productA);
      await expect(single(a, productA)).rejects.toMatchObject({
        code: 'PRODUCT_IMAGE_LIMIT_REACHED',
        status: 409,
      });
      expect(await imagesOf(productA)).toHaveLength(2);
    });

    it('blocks featuring and reordering but allows deleting', async () => {
      await resetDb();
      ({ a } = await seedTwoTenants({
        features: ALL_TOGGLEABLE_FEATURES.filter((key) => key !== 'productGallery'),
      }));
      const admin = await createTestUser();
      await addMember(admin.id, a.id, 'admin');
      productA = await insertProduct(a.id, 'Bar A');
      await upload(a, productA, 'one.png');
      await upload(a, productA, 'two.png');
      const [first, second] = (await imagesOf(productA)).map((r) => r.id);
      const caller = callerFor(a, admin);
      await expect(
        caller.products.images.setFeatured({ productId: productA, imageId: second! }),
      ).rejects.toMatchObject({ cause: { code: 'FEATURE_NOT_ENABLED' } });
      await expect(
        caller.products.images.reorder({ productId: productA, ids: [second!, first!] }),
      ).rejects.toMatchObject({ cause: { code: 'FEATURE_NOT_ENABLED' } });
      const images = await caller.products.images.delete({ productId: productA, imageId: first! });
      expect(images.map((i) => i.id)).toEqual([second]);
    });
  });
});
