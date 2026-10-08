export type MagicByteSegment = {
  bytes: readonly number[];
  offset: number;
};

export type MagicByteSignature = {
  name: string;
  bytes: readonly number[];
  offset?: number;
  segments?: readonly MagicByteSegment[];
};

export type ContentValidation = 'utf8' | 'json';

export type FileSafetyInput = {
  name: string;
  mime: string;
  bytes: number;
  signature?: string;
  content?: Uint8Array;
  width?: number;
  height?: number;
};

export type FileSafetyPolicy = {
  allowedMime: readonly string[];
  maxBytes: number;
  maxPixels?: number;
  signatures?: readonly string[];
  magicBytes?: readonly MagicByteSignature[];
  contentValidation?: ContentValidation;
  allowedExtensions?: readonly string[];
};

export type FileSafetyResult = {
  safe: boolean;
  failures: string[];
};

export type ArchiveEntry = {
  name: string;
  compressedBytes?: number;
  uncompressedBytes?: number;
  isSymlink?: boolean;
  nestedEntries?: readonly ArchiveEntry[];
};

export type ArchiveSafetyPolicy = {
  maxEntries: number;
  maxUncompressedBytes: number;
  maxDepth: number;
  maxCompressionRatio?: number;
};

export const EXTENSION_MIME_MAP: Readonly<Record<string, string>> = Object.freeze({
  avif: 'image/avif', bmp: 'image/bmp', gif: 'image/gif', jpeg: 'image/jpeg', jpg: 'image/jpeg',
  png: 'image/png', svg: 'image/svg+xml', webp: 'image/webp', zip: 'application/zip', txt: 'text/plain', json: 'application/json',
});

const riffSignature = [0x52, 0x49, 0x46, 0x46];
const ftypSignature = [0x66, 0x74, 0x79, 0x70];

export const MAGIC_BYTE_SIGNATURES: Readonly<Record<string, MagicByteSignature>> = Object.freeze({
  png: { name: 'PNG', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  jpeg: { name: 'JPEG', bytes: [0xff, 0xd8, 0xff] },
  gif: { name: 'GIF', bytes: [0x47, 0x49, 0x46, 0x38] },
  bmp: { name: 'BMP', bytes: [0x42, 0x4d] },
  webp: { name: 'WEBP', bytes: riffSignature, segments: [{ bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }] },
  avif: { name: 'AVIF', bytes: ftypSignature, offset: 4 },
  zip: { name: 'ZIP', bytes: [0x50, 0x4b, 0x03, 0x04] },
});

function normalizeExtension(name: string): string { const lastDot = name.lastIndexOf('.'); return lastDot < 0 ? '' : name.slice(lastDot + 1).trim().toLowerCase(); }
function normalizeSignature(signature: string): string { return signature.replace(/\s+/g, '').toLowerCase(); }
function isUnsafeName(name: string): boolean {
  if (!name.trim() || /^[A-Za-z]:($|[\\/])/.test(name) || /^[/\\]/.test(name)) return true;
  if (Array.from(name).some((char) => { const code = char.codePointAt(0) ?? 0; return code <= 0x1f || code === 0x7f; })) return true;
  const segments = name.replace(/\\/g, '/').split('/');
  return segments.length !== 1 || segments.some((segment) => segment === '..' || segment === '.');
}

export function validateBoundaryConditions(name: string, bytes: number): string | undefined {
  if (bytes === 0) return 'File is empty (0 bytes).';
  if (!name) return 'Filename is empty.';
  if (name.length > 255) return 'Filename exceeds maximum length of 255 characters.';
  if (Array.from(name).length > 150) return 'Filename contains excessive character payload length.';
  return undefined;
}

export function detectZipBombRisk(compressedSize: number, uncompressedSize: number, maxCompressionRatio: number = 40): { isBomb: boolean; reason?: string } {
  if (!Number.isFinite(compressedSize) || !Number.isFinite(uncompressedSize) || !Number.isFinite(maxCompressionRatio)) return { isBomb: true, reason: 'Invalid ZIP bomb detection input.' };
  if (compressedSize <= 0 || uncompressedSize < 0 || maxCompressionRatio <= 0) return { isBomb: true, reason: 'Invalid ZIP bomb detection boundary values.' };
  const ratio = uncompressedSize / compressedSize;
  return ratio > maxCompressionRatio ? { isBomb: true, reason: `Potential ZIP bomb detected: Expansion ratio ${ratio.toFixed(1)}x exceeds ${maxCompressionRatio}x.` } : { isBomb: false };
}

function matchesSegment(content: Uint8Array, segment: MagicByteSegment): boolean {
  if (!Number.isInteger(segment.offset) || segment.offset < 0 || content.length < segment.offset + segment.bytes.length) return false;
  return segment.bytes.every((expected, index) => content[segment.offset + index] === expected);
}
function matchesMagicBytes(content: Uint8Array, signature: MagicByteSignature): boolean {
  return matchesSegment(content, { bytes: signature.bytes, offset: signature.offset ?? 0 }) && (signature.segments ?? []).every((segment) => matchesSegment(content, segment));
}
export function verifyMagicBytesMatch(headerBytes: Uint8Array, allowedSignatures?: readonly string[]): boolean {
  if (!allowedSignatures?.length) return true;
  return allowedSignatures.some((name) => { const signature = MAGIC_BYTE_SIGNATURES[normalizeSignature(name)]; return signature ? matchesMagicBytes(headerBytes, signature) : false; });
}
function validateContent(content: Uint8Array, validation: ContentValidation, failures: string[]): void {
  try { const value = new TextDecoder('utf-8', { fatal: true }).decode(content).replace(/^\uFEFF/, ''); if (validation === 'json') JSON.parse(value); }
  catch { failures.push(validation === 'json' ? 'input JSON content is malformed' : 'input content is not valid UTF-8'); }
}

export function validateFileSafety(input: FileSafetyInput, policy: FileSafetyPolicy): FileSafetyResult {
  const failures: string[] = []; const name = input.name.trim(); const extension = normalizeExtension(name);
  const boundaryError = validateBoundaryConditions(name, input.bytes); if (boundaryError) failures.push(boundaryError);
  if (isUnsafeName(name)) failures.push('file name must be a single safe relative name');
  if (!Number.isInteger(input.bytes) || input.bytes < 1) failures.push('file size must be a positive integer');
  if (input.bytes > policy.maxBytes) failures.push('file exceeds the maximum size');
  if (!policy.allowedMime.includes(input.mime)) failures.push(`unsupported input MIME type: ${input.mime}`);
  if (input.content && input.content.byteLength !== input.bytes) failures.push('declared file size does not match input content length');
  if (policy.allowedExtensions) {
    if (!extension || !policy.allowedExtensions.includes(extension)) failures.push(`unsupported file extension: ${extension || '(none)'}`);
    const expectedMime = EXTENSION_MIME_MAP[extension]; if (expectedMime && expectedMime !== input.mime) failures.push(`file extension does not match MIME type: .${extension} -> ${input.mime}`);
  }
  if (input.width !== undefined || input.height !== undefined) {
    if (!Number.isInteger(input.width) || !input.width || input.width < 1) failures.push('width must be a positive integer');
    if (!Number.isInteger(input.height) || !input.height || input.height < 1) failures.push('height must be a positive integer');
    if (policy.maxPixels !== undefined && Number.isInteger(input.width) && Number.isInteger(input.height) && (input.width! * input.height!) > policy.maxPixels) failures.push('pixel count exceeds policy limit');
  }
  if (policy.signatures?.length && input.signature) {
    const normalizedInput = normalizeSignature(input.signature);
    if (!policy.signatures.some((allowed) => {
      const normalizedAllowed = normalizeSignature(allowed);
      return normalizedInput.startsWith(normalizedAllowed);
    })) failures.push('input signature does not match the allowed file signatures');
  }
  if (policy.magicBytes?.length && input.content && !policy.magicBytes.some((signature) => matchesMagicBytes(input.content!, signature))) failures.push('file magic bytes do not match an allowed signature');
  if (policy.contentValidation && input.content) validateContent(input.content, policy.contentValidation, failures);
  return { safe: failures.length === 0, failures };
}

export function validateArchiveEntries(entries: readonly ArchiveEntry[], policy: ArchiveSafetyPolicy): FileSafetyResult {
  const failures: string[] = []; let totalBytes = 0; let totalEntries = 0;
  const visit = (items: readonly ArchiveEntry[], depth: number): void => {
    if (depth > policy.maxDepth) { failures.push(`archive nesting depth exceeds ${policy.maxDepth}`); return; }
    for (const entry of items) {
      totalEntries += 1;
      if (totalEntries > policy.maxEntries) { failures.push(`archive contains more than ${policy.maxEntries} entries`); return; }
      if (!entry.name || isUnsafeName(entry.name)) failures.push(`unsafe archive entry name: ${entry.name || '(empty)'}`);
      if (entry.isSymlink) failures.push(`symlink archive entry is not permitted: ${entry.name}`);
      const compressed = entry.compressedBytes ?? 0; const uncompressed = entry.uncompressedBytes ?? 0;
      if (compressed < 0 || uncompressed < 0) failures.push(`invalid archive size metadata: ${entry.name}`);
      totalBytes += uncompressed; if (totalBytes > policy.maxUncompressedBytes) failures.push('archive exceeds maximum uncompressed size');
      if (policy.maxCompressionRatio !== undefined && compressed > 0) { const bomb = detectZipBombRisk(compressed, uncompressed, policy.maxCompressionRatio); if (bomb.isBomb) failures.push(bomb.reason ?? 'archive compression ratio is unsafe'); }
      if (entry.nestedEntries?.length) visit(entry.nestedEntries, depth + 1);
    }
  };
  visit(entries, 0);
  return { safe: failures.length === 0, failures };
}


// Media helpers reuse the canonical file-safety contract rather than creating a second safety authority.
export const MEDIA_LIMITS = Object.freeze({
  rasterInputBytes: 50 * 1024 * 1024,
  rasterOutputBytes: 50 * 1024 * 1024,
  rasterInputPixels: 100_000_000,
  rasterOutputPixels: 100_000_000,
  workerTimeoutMs: 8_000,
});

const IMAGE_SIGNATURE_BY_MIME: Readonly<Record<'image/png' | 'image/jpeg' | 'image/webp', string>> = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
});

const IMAGE_EFFECT_RANGES: Readonly<Record<string, readonly [number, number]>> = Object.freeze({
  brightness: [0, 200],
  contrast: [0, 200],
  saturation: [0, 200],
  grayscale: [0, 100],
});

export async function assertSafeRasterInput(blob: Blob): Promise<void> {
  const allowedMime = Object.keys(IMAGE_SIGNATURE_BY_MIME) as Array<keyof typeof IMAGE_SIGNATURE_BY_MIME>;
  const structural = validateFileSafety(
    { name: 'raster-input', mime: blob.type, bytes: blob.size },
    { allowedMime, maxBytes: MEDIA_LIMITS.rasterInputBytes },
  );
  if (!structural.safe) throw new Error(structural.failures.join('; '));
  const header = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  const signature = IMAGE_SIGNATURE_BY_MIME[blob.type as keyof typeof IMAGE_SIGNATURE_BY_MIME];
  if (!signature || !verifyMagicBytesMatch(header, [signature])) {
    throw new Error('Raster file signature does not match its declared MIME type.');
  }
}

export async function assertRasterOutput(blob: Blob, expectedMime: string): Promise<void> {
  if (!(expectedMime in IMAGE_SIGNATURE_BY_MIME)) throw new Error('Raster output MIME is not admitted.');
  if (blob.type !== expectedMime) throw new Error(`Raster output MIME mismatch: expected ${expectedMime}, got ${blob.type}.`);
  const structural = validateFileSafety(
    { name: 'raster-output', mime: blob.type, bytes: blob.size },
    { allowedMime: [expectedMime], maxBytes: MEDIA_LIMITS.rasterOutputBytes },
  );
  if (!structural.safe) throw new Error(structural.failures.join('; '));
  const header = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  const signature = IMAGE_SIGNATURE_BY_MIME[expectedMime as keyof typeof IMAGE_SIGNATURE_BY_MIME];
  if (!signature || !verifyMagicBytesMatch(header, [signature])) {
    throw new Error('Raster output signature does not match its declared MIME type.');
  }
}

export function assertImageDimensions(width: number, height: number, maxPixels = MEDIA_LIMITS.rasterInputPixels): void {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    throw new Error('Image dimensions must be positive integers.');
  }
  if (width * height > maxPixels) throw new Error('Image dimensions exceed the safe browser processing limit.');
}

export function assertImageOutputBudget(width: number, height: number): void {
  assertImageDimensions(width, height, MEDIA_LIMITS.rasterOutputPixels);
}

export function assertEffectParameters(effect: string, value: number): void {
  const range = IMAGE_EFFECT_RANGES[effect];
  if (!range || !Number.isFinite(value) || value < range[0] || value > range[1]) {
    throw new Error(`Image effect parameter is outside the admitted range: ${effect}=${String(value)}.`);
  }
}

export type RasterDimensions = Readonly<{ width: number; height: number }>;

function uint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}
function uint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}
function uint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}
function uint32LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]) | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}
function uint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}
function fourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function parsePngDimensions(bytes: Uint8Array): RasterDimensions | null {
  if (bytes.length < 24 || !matchesMagicBytes(bytes, MAGIC_BYTE_SIGNATURES.png)) return null;
  const width = uint32BE(bytes, 16);
  const height = uint32BE(bytes, 20);
  return width > 0 && height > 0 ? { width, height } : null;
}

function parseJpegDimensions(bytes: Uint8Array): RasterDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  const sofMarkers = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
  while (offset + 3 < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) return null;
    const segmentLength = uint16BE(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (sofMarkers.has(marker)) {
      if (segmentLength < 7) return null;
      const height = uint16BE(bytes, offset + 3);
      const width = uint16BE(bytes, offset + 5);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += segmentLength;
  }
  return null;
}

function parseWebpDimensions(bytes: Uint8Array): RasterDimensions | null {
  if (bytes.length < 16 || fourCC(bytes, 0) !== 'RIFF' || fourCC(bytes, 8) !== 'WEBP') return null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunk = fourCC(bytes, offset);
    const size = uint32LE(bytes, offset + 4) >>> 0;
    const data = offset + 8;
    if (data + size > bytes.length) return null;
    if (chunk === 'VP8X' && size >= 10) {
      const width = uint24LE(bytes, data + 4) + 1;
      const height = uint24LE(bytes, data + 7) + 1;
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (chunk === 'VP8 ' && size >= 10 && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
      const width = uint16LE(bytes, data + 6) & 0x3fff;
      const height = uint16LE(bytes, data + 8) & 0x3fff;
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (chunk === 'VP8L' && size >= 5 && bytes[data] === 0x2f) {
      const b0 = bytes[data + 1];
      const b1 = bytes[data + 2];
      const b2 = bytes[data + 3];
      const b3 = bytes[data + 4];
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset = data + size + (size % 2);
  }
  return null;
}

/** Read raster dimensions from a bounded header probe, before browser decode. */
export async function readRasterHeaderDimensions(
  blob: Blob,
  mime: string,
  maxProbeBytes = 64 * 1024,
): Promise<RasterDimensions | null> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) return null;
  const limit = Math.max(32, Math.min(maxProbeBytes, blob.size));
  const bytes = new Uint8Array(await blob.slice(0, limit).arrayBuffer());
  if (mime === 'image/png') return parsePngDimensions(bytes);
  if (mime === 'image/jpeg') return parseJpegDimensions(bytes);
  return parseWebpDimensions(bytes);
}
