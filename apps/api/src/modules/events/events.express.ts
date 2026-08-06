import { Router } from 'express';
import { ATTACHMENT_ALLOWED_MIME_TYPES, ATTACHMENT_MAX_SIZE_BYTES } from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { AppError, ErrorCodes } from '../../lib/errors';
import { guardSession } from '../../core/express/middleware/guardSession';
import { createUploadMiddleware } from '../../core/express/middleware/upload';
import { createUploadErrorHandler } from '../../core/express/middleware/uploadErrorHandler';
import { uploadPaymentAttachment } from './events.controller';

const upload = createUploadMiddleware({
  maxSizeBytes: ATTACHMENT_MAX_SIZE_BYTES,
  allowedMimeTypes: ATTACHMENT_ALLOWED_MIME_TYPES,
  invalidTypeError: new AppError(ErrorCodes.eventPayment.ATTACHMENT_INVALID_TYPE),
});

export const eventAttachmentsRouter = Router();

eventAttachmentsRouter.post(
  '/:paymentId/attachments',
  guardSession({ [RESOURCES.PAYMENT]: [ACTIONS.UPLOAD_ATTACHMENT] }),
  upload.single('file'),
  uploadPaymentAttachment,
);

eventAttachmentsRouter.use(
  createUploadErrorHandler({
    tooLargeErrorCode: ErrorCodes.eventPayment.ATTACHMENT_TOO_LARGE,
    uploadFailedErrorCode: ErrorCodes.eventPayment.ATTACHMENT_UPLOAD_FAILED,
  }),
);
