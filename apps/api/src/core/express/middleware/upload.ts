import multer from 'multer';

interface CreateUploadMiddlewareParams {
  maxSizeBytes: number;
  allowedMimeTypes: readonly string[];
  invalidTypeError: Error;
}

export function createUploadMiddleware({
  maxSizeBytes,
  allowedMimeTypes,
  invalidTypeError,
}: CreateUploadMiddlewareParams) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSizeBytes, files: 1 },
    fileFilter(_req, file, cb) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        cb(invalidTypeError);
        return;
      }
      cb(null, true);
    },
  });
}
