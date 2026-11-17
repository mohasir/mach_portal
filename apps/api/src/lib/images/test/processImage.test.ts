import { crc32 } from 'node:zlib';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  IMAGE_MAX_INPUT_PIXELS,
  IMAGE_MAX_SIDE,
  InvalidImageError,
  processImage,
  THUMB_MAX_SIDE,
} from '../processImage';

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } } });

// Rewrites the IHDR dimensions of a small PNG: the header announces a huge image while the
// file stays a few bytes, as a decompression bomb would.
function pngClaiming(png: Buffer, width: number, height: number): Buffer {
  const out = Buffer.from(png);
  const ihdr = 8;
  out.writeUInt32BE(width, ihdr + 8);
  out.writeUInt32BE(height, ihdr + 12);
  out.writeUInt32BE(crc32(out.subarray(ihdr + 4, ihdr + 8 + 13)), ihdr + 8 + 13);
  return out;
}

describe('processImage', () => {
  it('resizes a large image to WebP of at most 1600 px and a thumbnail of at most 400 px', async () => {
    const input = await solid(3200, 2000).jpeg().toBuffer();
    const result = await processImage(input);

    expect(result).toMatchObject({ width: IMAGE_MAX_SIDE, height: 1000 });
    const image = await sharp(result.image).metadata();
    const thumb = await sharp(result.thumb).metadata();
    expect(image).toMatchObject({ format: 'webp', width: 1600, height: 1000 });
    expect(thumb).toMatchObject({ format: 'webp', width: THUMB_MAX_SIDE, height: 250 });
  });

  it('never enlarges a small image', async () => {
    const input = await solid(300, 120).png().toBuffer();
    const result = await processImage(input);
    expect(result).toMatchObject({ width: 300, height: 120 });
    expect(await sharp(result.thumb).metadata()).toMatchObject({ width: 300, height: 120 });
  });

  it('applies the EXIF orientation and strips the metadata', async () => {
    const input = await solid(400, 200)
      .jpeg()
      .withExif({ IFD0: { Copyright: 'someone', Artist: 'camera owner' } })
      .withMetadata({ orientation: 6 })
      .toBuffer();
    expect(await sharp(input).metadata()).toMatchObject({ orientation: 6 });

    const result = await processImage(input);
    expect(result).toMatchObject({ width: 200, height: 400 });
    for (const output of [result.image, result.thumb]) {
      const meta = await sharp(output).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
    }
  });

  it('rejects a file that is not a decodable image', async () => {
    await expect(processImage(Buffer.from('%PDF-1.7 not an image'))).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });

  it('rejects a truncated image', async () => {
    const jpeg = await solid(800, 600).jpeg().toBuffer();
    await expect(processImage(jpeg.subarray(0, jpeg.length / 2))).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });

  it('rejects an image above the pixel limit before decoding it', async () => {
    const side = Math.ceil(Math.sqrt(IMAGE_MAX_INPUT_PIXELS)) + 1;
    const bomb = pngClaiming(await solid(1, 1).png().toBuffer(), side, side);
    expect(await sharp(bomb).metadata()).toMatchObject({ width: side, height: side });
    const error = await processImage(bomb).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvalidImageError);
    expect(String((error as InvalidImageError).cause)).toMatch(/pixel limit/i);
  });

  it.each(['jpeg', 'png', 'webp'] as const)('accepts %s content', async (format) => {
    const input = await solid(64, 48).toFormat(format).toBuffer();
    await expect(processImage(input)).resolves.toMatchObject({ width: 64, height: 48 });
  });

  it.each([
    [
      'svg',
      async () =>
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><rect width="64" height="48" fill="red"/></svg>',
        ),
    ],
    ['gif', () => solid(64, 48).gif().toBuffer()],
    ['tiff', () => solid(64, 48).tiff().toBuffer()],
  ])('rejects %s content whatever the declared type', async (format, build) => {
    const input = await build();
    expect((await sharp(input).metadata()).format).toBe(format);
    const error = await processImage(input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvalidImageError);
    expect(String((error as InvalidImageError).cause)).toMatch(/format/i);
  });
});
