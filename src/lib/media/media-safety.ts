import { verifyMagicBytesMatch } from '../contracts/file-safety.ts';

export type RasterImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export const MEDIA_LIMITS = Object.freeze({
  rasterInputBytes: 25 * 1024 * 1024,
  rasterInputPixels: 40_000_000,
  rasterOutputBytes: 50 * 1024 * 1024,
  rasterOutputPixels: 16_000_000,
  backgroundRemovalPixels: 8_000_000,
  videoInputBytes: 512 * 1024 * 1024,
  videoInputPixels: 64_000_000,
  videoOutputBytes: 512 * 1024 * 1024,
  videoOutputPixels: 64_000_000,
  videoMaxDurationSec: 10 * 60,
  videoTimeoutMs: 10 * 60 * 1000,
  imageTimeoutMs: 30_000,
  workerTimeoutMs: 30_000,
});

const RASTER_SIGNATURES: Record<RasterImageMime, readonly string[]> = {
  'image/png': ['png'],
  'image/jpeg': ['jpeg'],
  'image/webp': ['webp'],
};

function assertPositiveInteger(value: number, name: string, max?: number): void {
  if (!Number.isInteger(value) || value < 1 || (max !== undefined && value > max)) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function assertFiniteRange(value: number, name: string, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
}

export function assertRasterMime(mime: string): asserts mime is RasterImageMime {
  if (!(mime in RASTER_SIGNATURES)) throw new Error(`Unsupported raster image format: ${mime || '(missing MIME)'}`);
}

export async function assertSafeRasterInput(blob: Blob, maxPixels: number = MEDIA_LIMITS.rasterInputPixels): Promise<void> {
  assertRasterMime(blob.type);
  if (!Number.isInteger(blob.size) || blob.size < 1) throw new Error('Image input is empty.');
  if (blob.size > MEDIA_LIMITS.rasterInputBytes) throw new Error('Image input exceeds the 25 MB browser limit.');

  const header = new Uint8Array(await blob.slice(0, 1_048_576).arrayBuffer());
  if (!verifyMagicBytesMatch(header, RASTER_SIGNATURES[blob.type])) {
    throw new Error('Image file signature does not match its declared MIME type.');
  }

  const dimensions = readRasterDimensions(header, blob.type);
  if (dimensions && dimensions.width * dimensions.height > maxPixels) {
    throw new Error('Image dimensions exceed the safe browser processing limit.');
  }
}

export function assertImageDimensions(width: number, height: number, maxPixels: number): void {
  assertPositiveInteger(width, 'Image width');
  assertPositiveInteger(height, 'Image height');
  if (width * height > maxPixels) throw new Error('Image dimensions exceed the safe browser processing limit.');
}

export function assertImageOutputBudget(width: number, height: number): void {
  assertImageDimensions(width, height, MEDIA_LIMITS.rasterOutputPixels);
  if (width > 8000 || height > 8000) throw new Error('Image output dimensions exceed the safe browser limit.');
}

export function assertImageScale(scale: number): void {
  assertFiniteRange(scale, 'Scale', 0.25, 8);
  if (scale < 1) throw new Error('Scale must be at least 1 for the image upscaler.');
}

export function assertCropRectangle(
  crop: { x: number; y: number; width: number; height: number },
  sourceWidth: number,
  sourceHeight: number,
): void {
  assertPositiveInteger(sourceWidth, 'Source width');
  assertPositiveInteger(sourceHeight, 'Source height');
  if (!Number.isInteger(crop.x) || crop.x < 0) throw new Error('Crop X must be a non-negative integer.');
  if (!Number.isInteger(crop.y) || crop.y < 0) throw new Error('Crop Y must be a non-negative integer.');
  assertPositiveInteger(crop.width, 'Crop width');
  assertPositiveInteger(crop.height, 'Crop height');
  if (crop.x >= sourceWidth || crop.y >= sourceHeight || crop.x + crop.width > sourceWidth || crop.y + crop.height > sourceHeight) {
    throw new Error('Crop rectangle exceeds the source image bounds.');
  }
}

export function assertEffectParameters(
  effect: string,
  value: number,
): void {
  if (!['brightness', 'contrast', 'saturation', 'grayscale', 'invert', 'sepia', 'blur', 'sharpen'].includes(effect)) {
    throw new Error(`Unsupported image effect: ${effect}`);
  }
  assertFiniteRange(value, 'Effect value', 0, 200);
}

export function assertVideoBitrate(videoBitsPerSecond: number, audioBitsPerSecond: number): void {
  assertFiniteRange(videoBitsPerSecond, 'Video bitrate', 1_000, 50_000_000);
  assertFiniteRange(audioBitsPerSecond, 'Audio bitrate', 1_000, 512_000);
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) * 0x1000000 + (bytes[offset + 1] ?? 0) * 0x10000 + (bytes[offset + 2] ?? 0) * 0x100 + (bytes[offset + 3] ?? 0);
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

export function readRasterDimensions(
  header: Uint8Array,
  mime: RasterImageMime,
): { width: number; height: number } | undefined {
  if (mime === 'image/png' && header.length >= 24) {
    const width = readUint32BE(header, 16);
    const height = readUint32BE(header, 20);
    return width > 0 && height > 0 ? { width, height } : undefined;
  }

  if (mime === 'image/webp' && header.length >= 30) {
    const chunk = String.fromCharCode(header[12] ?? 0, header[13] ?? 0, header[14] ?? 0, header[15] ?? 0);
    if (chunk === 'VP8X') {
      const width = readUint24LE(header, 24) + 1;
      const height = readUint24LE(header, 27) + 1;
      return { width, height };
    }
    if (chunk === 'VP8L' && header.length >= 25) {
      const bits = (header[21] ?? 0) | ((header[22] ?? 0) << 8) | ((header[23] ?? 0) << 16) | ((header[24] ?? 0) << 24);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >>> 14) & 0x3fff) + 1;
      return { width, height };
    }
  }

  if (mime === 'image/jpeg' && header.length >= 4 && header[0] === 0xff && header[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < header.length) {
      while (offset < header.length && header[offset] !== 0xff) offset += 1;
      while (offset < header.length && header[offset] === 0xff) offset += 1;
      const marker = header[offset] ?? 0;
      offset += 1;
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue;
      if (offset + 2 > header.length) break;
      const segmentLength = readUint16BE(header, offset);
      if (segmentLength < 2 || offset + segmentLength > header.length) break;
      const isSof = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
      if (isSof && segmentLength >= 7) {
        const height = readUint16BE(header, offset + 3);
        const width = readUint16BE(header, offset + 5);
        return width > 0 && height > 0 ? { width, height } : undefined;
      }
      if (marker === 0xda) break;
      offset += segmentLength;
    }
  }

  return undefined;
}

export async function assertRasterOutput(blob: Blob, expectedMime: RasterImageMime): Promise<void> {
  if (blob.type !== expectedMime) throw new Error(`Unexpected image output MIME type: ${blob.type || '(missing MIME)'}`);
  if (!Number.isInteger(blob.size) || blob.size < 1) throw new Error('Image output is empty.');
  if (blob.size > MEDIA_LIMITS.rasterOutputBytes) throw new Error('Image output exceeds the safe browser size limit.');
  const header = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  if (!verifyMagicBytesMatch(header, RASTER_SIGNATURES[expectedMime])) {
    throw new Error('Image output signature does not match its declared MIME type.');
  }
}
