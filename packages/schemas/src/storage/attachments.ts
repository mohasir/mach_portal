export const ATTACHMENT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
export type AttachmentMimeType = (typeof ATTACHMENT_ALLOWED_MIME_TYPES)[number];
export const ATTACHMENT_MAX_SIZE_BYTES = 5 * 1024 * 1024;
