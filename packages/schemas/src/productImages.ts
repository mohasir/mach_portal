import { z } from 'zod';

export const PRODUCT_IMAGES_MAX = 5;
export const PRODUCT_IMAGE_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ProductImageMimeType = (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number];
export const PRODUCT_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const productImageIdSchema = z.object({
  productId: z.uuid(),
  imageId: z.uuid(),
});
export type ProductImageIdInput = z.infer<typeof productImageIdSchema>;

// The full order of the product's images, featured or not.
export const reorderProductImagesSchema = z.object({
  productId: z.uuid(),
  ids: z.array(z.uuid()).min(1).max(PRODUCT_IMAGES_MAX),
});
export type ReorderProductImagesInput = z.infer<typeof reorderProductImagesSchema>;
