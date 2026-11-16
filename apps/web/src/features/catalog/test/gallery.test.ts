import { describe, expect, it } from 'vitest';
import { PRODUCT_IMAGES_MAX } from '@repo/schemas';
import { featuredImage, fitsInGallery, galleryState, moveImage } from '../gallery';

const image = (id: string, isFeatured = false) => ({
  id,
  thumbUrl: `t/${id}`,
  imageUrl: `i/${id}`,
  isFeatured,
  sortOrder: 0,
});

describe('featuredImage', () => {
  it('returns the featured image wherever it sits', () => {
    expect(featuredImage([image('a'), image('b', true)])?.id).toBe('b');
  });

  it('falls back to the first image when none is marked', () => {
    expect(featuredImage([image('a'), image('b')])?.id).toBe('a');
  });

  it('is null without images, so the neutral placeholder shows', () => {
    expect(featuredImage([])).toBeNull();
  });
});

describe('galleryState', () => {
  it('counts against the maximum and allows uploads while there is room', () => {
    expect(galleryState([image('a')])).toEqual({
      count: 1,
      max: PRODUCT_IMAGES_MAX,
      canUpload: true,
      isEmpty: false,
    });
  });

  it('stops uploads once full', () => {
    const full = Array.from({ length: PRODUCT_IMAGES_MAX }, (_, i) => image(String(i)));
    expect(galleryState(full)).toMatchObject({ count: PRODUCT_IMAGES_MAX, canUpload: false });
  });

  it('reports an empty gallery', () => {
    expect(galleryState([])).toMatchObject({ count: 0, canUpload: true, isEmpty: true });
  });
});

describe('fitsInGallery', () => {
  it('accepts the files of one selection only while they fit', () => {
    expect([0, 1, 2].map((index) => fitsInGallery(3, index))).toEqual([true, true, false]);
    expect(fitsInGallery(PRODUCT_IMAGES_MAX, 0)).toBe(false);
  });
});

describe('moveImage', () => {
  const ids = ['a', 'b', 'c'];

  it('swaps an image with its neighbour', () => {
    expect(moveImage(ids, 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveImage(ids, 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  it('returns null at either end or for an unknown id', () => {
    expect(moveImage(ids, 'a', -1)).toBeNull();
    expect(moveImage(ids, 'c', 1)).toBeNull();
    expect(moveImage(ids, 'x', 1)).toBeNull();
  });
});
