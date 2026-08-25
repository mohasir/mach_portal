import { MulterError } from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../lib/errors';

interface UploadErrorHandlerParams {
  tooLargeErrorCode: string;
  uploadFailedErrorCode: string;
}

/**
 * Error-mapping middleware shared by every raw upload route — translates
 * MulterError / AppError / unknown failures into `{ errorCode }` JSON, since
 * these routes have no tRPC `errorFormatter` to do it for them. `AppError`'s own
 * `status` (default 400) drives the HTTP status, so this stays error-code-agnostic.
 */
export function createUploadErrorHandler({
  tooLargeErrorCode,
  uploadFailedErrorCode,
}: UploadErrorHandlerParams) {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof MulterError) {
      const errorCode = err.code === 'LIMIT_FILE_SIZE' ? tooLargeErrorCode : uploadFailedErrorCode;
      res.status(400).json({ errorCode });
      return;
    }
    if (err instanceof AppError) {
      res.status(err.status).json({ errorCode: err.code });
      return;
    }
    console.error('[upload]', err);
    res.status(500).json({ errorCode: uploadFailedErrorCode });
  };
}
