import { Router } from 'express';
import { ATTACHMENT_ALLOWED_MIME_TYPES, ATTACHMENT_MAX_SIZE_BYTES } from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import type { Database } from '../../db';
import { AppError, ErrorCodes } from '../../lib/errors';
import { guardTenantSession } from '../../core/express/middleware/guardTenantSession';
import { createUploadMiddleware } from '../../core/express/middleware/upload';
import { createUploadErrorHandler } from '../../core/express/middleware/uploadErrorHandler';
import { uploadPaymentAttachment } from './events.controller';

const upload = createUploadMiddleware({
  maxSizeBytes: ATTACHMENT_MAX_SIZE_BYTES,
  allowedMimeTypes: ATTACHMENT_ALLOWED_MIME_TYPES,
  invalidTypeError: new AppError(ErrorCodes.eventPayment.ATTACHMENT_INVALID_TYPE),
});

// `database` is the client the guard opens tenant transactions on; the app pool when absent.
export function createEventAttachmentsRouter(database?: Database) {
  const router = Router();

  router.post(
    '/:paymentId/attachments',
    guardTenantSession({ [RESOURCES.PAYMENT]: [ACTIONS.UPLOAD_ATTACHMENT] }, database),
    upload.single('file'),
    uploadPaymentAttachment,
  );

  router.use(
    createUploadErrorHandler({
      tooLargeErrorCode: ErrorCodes.eventPayment.ATTACHMENT_TOO_LARGE,
      uploadFailedErrorCode: ErrorCodes.eventPayment.ATTACHMENT_UPLOAD_FAILED,
    }),
  );

  return router;
}

export const eventAttachmentsRouter = createEventAttachmentsRouter();
