import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { PRODUCT_IMAGE_ALLOWED_MIME_TYPES, PRODUCT_IMAGE_MAX_SIZE_BYTES } from '@repo/schemas';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { Database, TenantRunner } from '../../db';
import { AppError, ErrorCodes } from '../../lib/errors';
import { guardTenantSession } from '../../core/express/middleware/guardTenantSession';
import { createUploadMiddleware } from '../../core/express/middleware/upload';
import { createUploadErrorHandler } from '../../core/express/middleware/uploadErrorHandler';
import { productImageUploaderModule } from './products.module';

const upload = createUploadMiddleware({
  maxSizeBytes: PRODUCT_IMAGE_MAX_SIZE_BYTES,
  allowedMimeTypes: PRODUCT_IMAGE_ALLOWED_MIME_TYPES,
  invalidTypeError: new AppError(ErrorCodes.productImage.INVALID_IMAGE),
});

// Mounted behind guardTenantSession, which sets res.locals.tenantId, userId and runInTenant only
// after every tenant, membership, permission and module check passed.
async function uploadProductImage(req: Request, res: Response) {
  const tenantId = res.locals['tenantId'] as string | undefined;
  const userId = res.locals['userId'] as string | undefined;
  const runInTenant = res.locals['runInTenant'] as TenantRunner | undefined;
  if (!tenantId || !userId || !runInTenant) {
    throw new Error('uploadProductImage requires guardTenantSession');
  }

  const parsedId = z.uuid().safeParse(req.params['productId']);
  if (!parsedId.success) {
    res.status(404).json({ errorCode: ErrorCodes.product.NOT_FOUND });
    return;
  }
  if (!req.file) {
    res.status(400).json({ errorCode: ErrorCodes.productImage.INVALID_IMAGE });
    return;
  }
  const image = await productImageUploaderModule(runInTenant, tenantId).add(
    parsedId.data,
    req.file,
    userId,
  );
  res.status(201).json(image);
}

// `database` is the client the guard opens tenant transactions on; the app pool when absent.
export function createProductImagesRouter(database?: Database) {
  const router = Router();

  router.post(
    '/:productId/images',
    guardTenantSession({ [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] }, database),
    upload.single('file'),
    uploadProductImage,
  );

  router.use(
    createUploadErrorHandler({
      tooLargeErrorCode: ErrorCodes.productImage.TOO_LARGE,
      uploadFailedErrorCode: ErrorCodes.productImage.UPLOAD_FAILED,
    }),
  );

  return router;
}

export const productImagesRouter = createProductImagesRouter();
