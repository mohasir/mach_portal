import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { PRODUCT_IMAGES_MAX_WITHOUT_GALLERY, productImagesLimit } from '@repo/schemas';
import type { TenantRunner, Tx } from '../../db';
import type { AfterCommit } from '../../core/trpc/tenantCtx';
import { runInBackground } from '../../lib/background';
import { AppError, ErrorCodes } from '../../lib/errors';
import { InvalidImageError, processImage } from '../../lib/images/processImage';
import { getStorageProvider, type StorageProvider } from '../../lib/storage';
import type { ProductImagesRepository } from './products.images.repository';
import { productImageResource } from './products.resource';

// Structural subset of Express.Multer.File, so the multer types stay out of AppRouter's surface.
export type UploadedProductImageFile = {
  buffer: Buffer;
  originalname: string;
};

const WEBP = 'image/webp';

const productNotFound = () =>
  new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.product.NOT_FOUND) });
const imageNotFound = () =>
  new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.productImage.NOT_FOUND) });

// Called only from the Express upload route, so it throws bare AppErrors (no tRPC formatter
// there). No transaction stays open while sharp runs or the files travel to storage.
export class ProductImageUploader {
  constructor(
    private runInTenant: TenantRunner,
    private repositoryFor: (tx: Tx) => ProductImagesRepository,
    private tenantId: string,
    private galleryEnabled: boolean,
    private storage: StorageProvider = getStorageProvider(),
  ) {}

  // Without the gallery add-on a product holds a single image, which a new upload replaces. More
  // than one stored (the add-on was switched off afterwards) is never replaced: that would silently
  // drop images, so the upload is refused until they are removed.
  private async assertRoomFor(repo: ProductImagesRepository, productId: string) {
    const count = await repo.count(productId);
    const limit = productImagesLimit(this.galleryEnabled);
    const replaces = !this.galleryEnabled && count === PRODUCT_IMAGES_MAX_WITHOUT_GALLERY;
    if (count >= limit && !replaces) {
      throw new AppError(ErrorCodes.productImage.LIMIT_REACHED, undefined, 409);
    }
  }

  async add(productId: string, file: UploadedProductImageFile, uploadedById: string | null) {
    await this.runInTenant(async (tx) => {
      const repo = this.repositoryFor(tx);
      if (!(await repo.findProduct(productId))) {
        throw new AppError(ErrorCodes.product.NOT_FOUND, undefined, 404);
      }
      await this.assertRoomFor(repo, productId);
    });

    const processed = await processImage(file.buffer).catch((error: unknown) => {
      if (error instanceof InvalidImageError) {
        throw new AppError(ErrorCodes.productImage.INVALID_IMAGE);
      }
      throw error;
    });

    // Every read and delete goes through the stored keys, never rebuilt ones.
    const base = `t/${this.tenantId}/products/${productId}/${randomUUID()}`;
    // Settled together, so a file whose upload finishes after the other one failed is cleaned too.
    const results = await Promise.allSettled(
      [
        { key: `${base}.webp`, body: processed.image },
        { key: `${base}-thumb.webp`, body: processed.thumb },
      ].map(async ({ key, body }) => {
        const { url } = await this.storage.upload({ key, body, contentType: WEBP });
        return { key, url };
      }),
    );
    const stored = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));

    try {
      const failed = results.find((r) => r.status === 'rejected');
      if (failed) throw failed.reason;
      const [image, thumb] = stored;

      const replacedKeys: string[] = [];
      const row = await this.runInTenant(async (tx) => {
        const repo = this.repositoryFor(tx);
        // Another upload may have finished since phase 1: the maximum is checked again under lock.
        if (!(await repo.lockProduct(productId))) {
          throw new AppError(ErrorCodes.product.NOT_FOUND, undefined, 404);
        }
        await this.assertRoomFor(repo, productId);
        if (!this.galleryEnabled) {
          for (const old of await repo.listKeys(productId)) {
            await repo.delete(productId, old.id);
            replacedKeys.push(old.imageKey, old.thumbKey);
          }
        }
        return repo.insert({
          productId,
          imageKey: image!.key,
          imageUrl: image!.url,
          thumbKey: thumb!.key,
          thumbUrl: thumb!.url,
          fileName: file.originalname,
          size: processed.image.length,
          width: processed.width,
          height: processed.height,
          createdById: uploadedById,
        });
      });
      // Best effort, once the row swap committed: a failure only leaves an orphan.
      await Promise.all(
        replacedKeys.map((key) =>
          this.storage
            .delete(key)
            .catch((cleanupErr) => console.error('storage delete failed', cleanupErr)),
        ),
      );
      return productImageResource(row);
    } catch (err) {
      // Best effort: without a row nothing references the objects, so they would only leak space.
      await Promise.all(
        stored.map(({ key }) =>
          this.storage
            .delete(key)
            .catch((cleanupErr) => console.error('storage delete failed', cleanupErr)),
        ),
      );
      throw err;
    }
  }
}

export class ProductImagesService {
  constructor(
    private repo: ProductImagesRepository,
    private afterCommit: AfterCommit,
    private storage: StorageProvider = getStorageProvider(),
  ) {}

  private async lockProduct(productId: string) {
    if (!(await this.repo.lockProduct(productId))) throw productNotFound();
  }

  private async list(productId: string) {
    return (await this.repo.listByProduct(productId)).map(productImageResource);
  }

  async setFeatured(productId: string, imageId: string) {
    await this.lockProduct(productId);
    if (!(await this.repo.setFeatured(productId, imageId))) throw imageNotFound();
    return this.list(productId);
  }

  // `ids` must name every image of the product exactly once.
  async reorder(productId: string, ids: string[]) {
    await this.lockProduct(productId);
    const current = new Set((await this.repo.listByProduct(productId)).map((image) => image.id));
    const requested = new Set(ids);
    if (
      requested.size !== ids.length ||
      requested.size !== current.size ||
      ids.some((id) => !current.has(id))
    ) {
      throw imageNotFound();
    }
    await this.repo.reorder(productId, ids);
    return this.list(productId);
  }

  // The row is the source of truth: the files go only once the delete has committed, so a rolled
  // back request never loses them, and a failed storage delete only leaves an orphan, logged.
  async delete(productId: string, imageId: string) {
    await this.lockProduct(productId);
    const deleted = await this.repo.delete(productId, imageId);
    if (!deleted) throw imageNotFound();
    if (deleted.isFeatured) await this.repo.featureFirst(productId);
    this.afterCommit(() => {
      for (const key of [deleted.imageKey, deleted.thumbKey]) {
        runInBackground('storage delete failed', () => this.storage.delete(key));
      }
    });
    return this.list(productId);
  }
}
