import { PRODUCT_IMAGES_MAX } from '@repo/schemas';

export interface GalleryImage {
  id: string;
  thumbUrl: string;
  imageUrl: string;
  isFeatured: boolean;
}

/** The image lists and pickers show; null leaves the neutral placeholder. */
export function featuredImage<T extends GalleryImage>(images: readonly T[]): T | null {
  return images.find((image) => image.isFeatured) ?? images[0] ?? null;
}

export function galleryState(images: readonly GalleryImage[]) {
  return {
    count: images.length,
    max: PRODUCT_IMAGES_MAX,
    canUpload: images.length < PRODUCT_IMAGES_MAX,
    isEmpty: images.length === 0,
  };
}

/** Whether the file at `batchIndex` of one selection still fits next to `count` stored images. */
export function fitsInGallery(count: number, batchIndex: number): boolean {
  return count + batchIndex < PRODUCT_IMAGES_MAX;
}

/** The new order after moving `id` one place; null when it cannot move that way. */
export function moveImage(ids: readonly string[], id: string, direction: -1 | 1): string[] | null {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= ids.length) return null;
  const next = [...ids];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}
