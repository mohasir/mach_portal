export const IMAGE_MAX_SIDE = 1600;
export const THUMB_MAX_SIDE = 400;
// Checked against the header before decoding, so a small file announcing a huge canvas never
// reaches memory. Covers the photos of current phone cameras.
export const IMAGE_MAX_INPUT_PIXELS = 50_000_000;

// Decided from the content, not the declared type: sharp also decodes SVG, GIF, TIFF and HEIF,
// and SVG runs through librsvg.
export const IMAGE_ALLOWED_FORMATS: readonly string[] = ['jpeg', 'png', 'webp'];

export class InvalidImageError extends Error {
  constructor(cause: unknown) {
    super('The file is not a decodable image within the pixel limit', { cause });
    this.name = 'InvalidImageError';
  }
}

export type ProcessedImage = { image: Buffer; thumb: Buffer; width: number; height: number };

// sharp is a native module loaded on first use, so the API still starts where its binary is
// missing; only uploads fail then.
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const { default: sharp } = await import('sharp');
  try {
    const { format } = await sharp(input, { limitInputPixels: IMAGE_MAX_INPUT_PIXELS }).metadata();
    if (!format || !IMAGE_ALLOWED_FORMATS.includes(format)) {
      throw new Error(`Image format ${format ?? 'unknown'} is not allowed`);
    }
    // Without withMetadata/keepExif sharp writes no EXIF, so orientation is applied to the pixels.
    const source = sharp(input, {
      limitInputPixels: IMAGE_MAX_INPUT_PIXELS,
      failOn: 'truncated',
    }).autoOrient();
    const fitInside = (side: number) =>
      ({ width: side, height: side, fit: 'inside', withoutEnlargement: true }) as const;
    const [image, thumb] = await Promise.all([
      source
        .clone()
        .resize(fitInside(IMAGE_MAX_SIDE))
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true }),
      source.clone().resize(fitInside(THUMB_MAX_SIDE)).webp({ quality: 75 }).toBuffer(),
    ]);
    return { image: image.data, thumb, width: image.info.width, height: image.info.height };
  } catch (error) {
    throw new InvalidImageError(error);
  }
}
