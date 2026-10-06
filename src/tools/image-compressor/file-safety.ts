import { validateFileSafety } from '../../lib/contracts/file-safety.ts';

export const IMAGE_COMPRESSOR_MAX_INPUT_SIZE = 10 * 1024 * 1024;
export const IMAGE_COMPRESSOR_MAX_PIXELS = 16_000_000;

const IMAGE_COMPRESSOR_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
const IMAGE_COMPRESSOR_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;


export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageSafetyInput {
  name: string;
  type: string;
  size: number;
  content?: Uint8Array;
}

function safetyError(failures: string[]): Error {
  if (failures.some((failure) => failure.startsWith('unsupported input MIME type:'))) {
    return new Error('Unsupported image format');
  }
  if (failures.includes('file exceeds the maximum size')) {
    return new Error('File is larger than the 10 MB browser limit');
  }
  if (
    failures.includes('pixel count exceeds policy limit') ||
    failures.includes('input exceeds the maximum pixel count')
  ) {
    return new Error(
      'The source image is too large for safe browser processing. Reduce the dimensions and try again.',
    );
  }
  if (failures.some((failure) => failure.includes('width') || failure.includes('height'))) {
    return new Error('The source image has invalid dimensions');
  }
  return new Error(failures.join('; '));
}

export function assertSafeImageInput(
  file: ImageSafetyInput,
  dimensions?: ImageDimensions,
): void {
  if (!file.name.trim()) {
    throw new Error('Image file name is required');
  }
  if (!Number.isFinite(file.size) || file.size < 0) {
    throw new Error('Invalid image file size');
  }

  const result = validateFileSafety(
    {
      name: file.name,
      mime: file.type,
      bytes: file.size,
      content: file.content,
      width: dimensions?.width,
      height: dimensions?.height,
    },
    {
      allowedMime: IMAGE_COMPRESSOR_ALLOWED_MIME,
      maxBytes: IMAGE_COMPRESSOR_MAX_INPUT_SIZE,
      allowedExtensions: IMAGE_COMPRESSOR_EXTENSIONS,
      ...(dimensions ? { maxPixels: IMAGE_COMPRESSOR_MAX_PIXELS } : {}),
      ...(file.content ? { magicBytes: [
        'png', 'jpeg', 'webp',
      ].map((name) => (name === 'png' ? ( { name: 'PNG', bytes: [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a] } ) : name === 'jpeg' ? ( { name: 'JPEG', bytes: [0xff,0xd8,0xff] } ) : ( { name: 'WEBP', bytes: [0x52,0x49,0x46,0x46], segments: [{ bytes: [0x57,0x45,0x42,0x50], offset: 8 }] } )) ) } : {}),
    },
  );

  if (!result.safe) {
    throw safetyError(result.failures);
  }
}

export function validateCompressionOptions(options: CompressionOptionsLike): void {
  if (!Number.isFinite(options.quality) || options.quality < 0.01 || options.quality > 1) throw new Error('Invalid compression quality');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(options.format)) throw new Error('Unsupported compression output format');
  if (options.targetSizeKB !== undefined && (!Number.isInteger(options.targetSizeKB) || options.targetSizeKB < 1 || options.targetSizeKB > 64 * 1024)) {
    throw new Error('Invalid compression target size');
  }
  for (const [label, value] of [['maxWidth', options.maxWidth], ['maxHeight', options.maxHeight] as const]) {
    if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > 4_000)) throw new Error(`Invalid compression ${label}`);
  }
}

export type CompressionOptionsLike = {
  quality: number;
  format: 'image/jpeg' | 'image/png' | 'image/webp';
  maxWidth?: number;
  maxHeight?: number;
  targetSizeKB?: number;
}
