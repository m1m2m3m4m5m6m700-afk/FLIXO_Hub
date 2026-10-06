import { MAGIC_BYTE_SIGNATURES, validateFileSafety } from '../../lib/contracts/file-safety.ts';

export const IMAGE_COMPRESSOR_MAX_INPUT_SIZE = 10 * 1024 * 1024;
export const IMAGE_COMPRESSOR_MAX_PIXELS = 40_000_000;

const IMAGE_COMPRESSOR_ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/svg+xml',
] as const;

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

export async function assertSafeImageInput(
  file: ImageSafetyInput,
  dimensions?: ImageDimensions,
): Promise<void> {
  if (!file.name.trim()) {
    throw new Error('Image file name is required');
  }
  if (!Number.isFinite(file.size) || file.size < 0) {
    throw new Error('Invalid image file size');
  }

  const content = file.content ?? new Uint8Array(await (file as ImageSafetyInput & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer?.() ?? []);
  const extension = file.name.slice(file.name.lastIndexOf('.') + 1).trim().toLowerCase();
  const policy = {
    allowedMime: IMAGE_COMPRESSOR_ALLOWED_MIME,
    maxBytes: IMAGE_COMPRESSOR_MAX_INPUT_SIZE,
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'],
    ...(dimensions ? { maxPixels: IMAGE_COMPRESSOR_MAX_PIXELS } : {}),
    ...(file.type === 'image/png' ? { magicBytes: [MAGIC_BYTE_SIGNATURES.png] } :
      file.type === 'image/jpeg' ? { magicBytes: [MAGIC_BYTE_SIGNATURES.jpeg] } :
      file.type === 'image/webp' ? { magicBytes: [MAGIC_BYTE_SIGNATURES.webp] } :
      file.type === 'image/gif' ? { magicBytes: [MAGIC_BYTE_SIGNATURES.gif] } :
      file.type === 'image/bmp' ? { magicBytes: [MAGIC_BYTE_SIGNATURES.bmp] } : {}),
  } as const;
  void extension;
  const result = validateFileSafety(
    {
      name: file.name,
      mime: file.type,
      bytes: file.size,
      ...(content.byteLength === file.size ? { content } : {}),
      width: dimensions?.width,
      height: dimensions?.height,
    },
    policy,
  );

  if (!result.safe) throw safetyError(result.failures);
}
