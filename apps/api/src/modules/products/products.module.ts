import { ACTIONS, can, RESOURCES } from '@repo/guards';
import type { TenantRunner } from '../../db';
import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { ProductImagesRepository } from './products.images.repository';
import { ProductImagesService, ProductImageUploader } from './products.images.service';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

export function productsModule(ctx: TenantCtx) {
  return new ProductsService(
    new ProductsRepository(ctx.db, ctx.tenantId),
    ctx.features.has('priceTiers'),
    {
      read: can(ctx.access, { [RESOURCES.PRODUCT_COST]: [ACTIONS.READ] }),
      update: can(ctx.access, { [RESOURCES.PRODUCT_COST]: [ACTIONS.UPDATE] }),
    },
    ctx.features.has('unitsOfMeasure'),
  );
}

export function productImagesModule(ctx: TenantCtx) {
  return new ProductImagesService(
    new ProductImagesRepository(ctx.db, ctx.tenantId),
    ctx.afterCommit,
  );
}

// No request transaction: each phase of the upload opens its own short one through `runInTenant`.
export function productImageUploaderModule(
  runInTenant: TenantRunner,
  tenantId: string,
  galleryEnabled: boolean,
) {
  return new ProductImageUploader(
    runInTenant,
    (tx) => new ProductImagesRepository(tx, tenantId),
    tenantId,
    galleryEnabled,
  );
}
