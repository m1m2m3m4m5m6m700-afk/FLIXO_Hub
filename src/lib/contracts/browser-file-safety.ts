import { MAGIC_BYTE_SIGNATURES, validateFileSafety, type FileSafetyResult, type FileSafetyPolicy } from './file-safety.ts';

export type BrowserFileDimensions = { width: number; height: number };

export type BrowserFileValidationPolicy = FileSafetyPolicy & {
  decoder?: (file: File) => Promise<BrowserFileDimensions>;
};

export type BrowserFileValidationResult = FileSafetyResult & {
  decoded: boolean;
  width?: number;
  height?: number;
};

const DEFAULT_IMAGE_POLICY: BrowserFileValidationPolicy = {
  maxBytes: 25 * 1024 * 1024,
  maxPixels: 40_000_000,
  allowedMime: ['image/avif', 'image/bmp', 'image/gif', 'image/jpeg', 'image/png', 'image/webp'],
  allowedExtensions: ['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'webp'],
  magicBytes: [
    MAGIC_BYTE_SIGNATURES.avif,
    MAGIC_BYTE_SIGNATURES.bmp,
    MAGIC_BYTE_SIGNATURES.gif,
    MAGIC_BYTE_SIGNATURES.jpeg,
    MAGIC_BYTE_SIGNATURES.png,
    MAGIC_BYTE_SIGNATURES.webp,
  ],
};

const MIME_EXTENSION_MAP: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'image/avif': ['avif'],
  'image/bmp': ['bmp'],
  'image/gif': ['gif'],
  'image/jpeg': ['jpeg', 'jpg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
});

const MIME_MAGIC_MAP: Readonly<Record<string, FileSafetyPolicy['magicBytes']>> = Object.freeze({
  'image/avif': [MAGIC_BYTE_SIGNATURES.avif],
  'image/bmp': [MAGIC_BYTE_SIGNATURES.bmp],
  'image/gif': [MAGIC_BYTE_SIGNATURES.gif],
  'image/jpeg': [MAGIC_BYTE_SIGNATURES.jpeg],
  'image/png': [MAGIC_BYTE_SIGNATURES.png],
  'image/webp': [MAGIC_BYTE_SIGNATURES.webp],
});

async function decodeImage(file: File): Promise<BrowserFileDimensions> {
  if ('createImageBitmap' in window && typeof window.createImageBitmap === 'function') {
    try {
      const bitmap = await window.createImageBitmap(file);
      try {
        return { width: bitmap.width, height: bitmap.height };
      } finally {
        bitmap.close();
      }
    } catch {
      // Fall through to the HTML image decoder for formats/browsers without bitmap support.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
    if (!Number.isInteger(dimensions.width) || !Number.isInteger(dimensions.height) || dimensions.width < 1 || dimensions.height < 1) {
      throw new Error('The selected image has invalid dimensions.');
    }
    return dimensions;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const withCanonicalRasterChecks = (file: File, policy: BrowserFileValidationPolicy): BrowserFileValidationPolicy => {
  const inferredExtensions = MIME_EXTENSION_MAP[file.type];
  const inferredMagic = MIME_MAGIC_MAP[file.type];
  if (!inferredExtensions || !inferredMagic) {
    return { ...policy, decoder: policy.decoder ?? decodeImage };
  }
  return {
    ...policy,
    allowedExtensions: policy.allowedExtensions ?? inferredExtensions,
    magicBytes: policy.magicBytes ?? inferredMagic,
    decoder: policy.decoder ?? decodeImage,
  };
};

export async function validateBrowserFile(
  file: File,
  policy: BrowserFileValidationPolicy = { ...DEFAULT_IMAGE_POLICY, decoder: decodeImage },
): Promise<BrowserFileValidationResult> {
  const failures: string[] = [];
  let content: Uint8Array;

  try {
    content = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { safe: false, failures: ['failed to read file bytes'], decoded: false };
  }

  const effectivePolicy = withCanonicalRasterChecks(file, policy);
  const safety = validateFileSafety(
    {
      name: file.name,
      mime: file.type,
      bytes: file.size,
      content,
    },
    effectivePolicy,
  );
  failures.push(...safety.failures);

  if (failures.length > 0 || !effectivePolicy.decoder) {
    return { safe: failures.length === 0, failures, decoded: false };
  }

  try {
    const dimensions = await effectivePolicy.decoder(file);
    const dimensionCheck = validateFileSafety(
      {
        name: file.name,
        mime: file.type,
        bytes: file.size,
        width: dimensions.width,
        height: dimensions.height,
      },
      effectivePolicy,
    );
    if (!dimensionCheck.safe) failures.push(...dimensionCheck.failures);
    return {
      safe: failures.length === 0,
      failures,
      decoded: failures.length === 0,
      width: dimensions.width,
      height: dimensions.height,
    };
  } catch {
    failures.push('file decoder rejected the input');
    return { safe: false, failures, decoded: false };
  }
}

export const IMAGE_BROWSER_FILE_POLICY: BrowserFileValidationPolicy = Object.freeze({
  ...DEFAULT_IMAGE_POLICY,
  decoder: decodeImage,
});
