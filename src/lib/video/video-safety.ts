import { MAGIC_BYTE_SIGNATURES, type MagicByteSignature } from '../contracts/file-safety.ts';

export const VIDEO_LIMITS = Object.freeze({
  maxInputBytes: 512 * 1024 * 1024,
  maxInputPixels: 64_000_000,
  maxDurationSec: 10 * 60,
  maxOutputBytes: 512 * 1024 * 1024,
  maxOutputPixels: 64_000_000,
  maxWidth: 8000,
  maxHeight: 8000,
  maxFps: 60,
  timeoutMs: 10 * 60 * 1000,
});

const VIDEO_SIGNATURES: Record<string, MagicByteSignature> = {
  webm: MAGIC_BYTE_SIGNATURES.webm,
  mp4: { name: 'MP4/ISO-BMFF', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  quicktime: { name: 'QuickTime/ISO-BMFF', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  ogg: { name: 'Ogg', bytes: [0x4f, 0x67, 0x67, 0x53] },
};

const MIME_TO_SIGNATURE = Object.freeze({
  'video/webm': 'webm',
  'video/mp4': 'mp4',
  'video/quicktime': 'quicktime',
  'video/ogg': 'ogg',
} as const);

export type SupportedVideoMime = keyof typeof MIME_TO_SIGNATURE;

function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number.`);
}

function assertIntegerRange(value: number, name: string, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer between ${min} and ${max}.`);
}

export function assertSupportedVideoMime(mime: string): asserts mime is SupportedVideoMime {
  if (!(mime in MIME_TO_SIGNATURE)) throw new Error(`Unsupported video format: ${mime || '(missing MIME)'}`);
}

export async function assertSafeVideoInput(blob: Blob): Promise<void> {
  assertSupportedVideoMime(blob.type);
  if (!Number.isInteger(blob.size) || blob.size < 1) throw new Error('Video input is empty.');
  if (blob.size > VIDEO_LIMITS.maxInputBytes) throw new Error('Video input exceeds the 512 MB browser limit.');
  const signature = MIME_TO_SIGNATURE[blob.type];
  const expected = VIDEO_SIGNATURES[signature];
  const header = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  const matches = expected.bytes.every((value, index) => header[(expected.offset ?? 0) + index] === value);
  if (!matches) throw new Error('Video file signature does not match its declared MIME type.');
}

export function validateVideoRenderOptions(
  options: Readonly<{
    durationSec: number;
    startSec?: number;
    endSec?: number;
    crop?: Readonly<{ x: number; y: number; width: number; height: number }>;
    width?: number;
    height?: number;
    fps?: number;
    videoBitsPerSecond?: number;
    audioBitsPerSecond?: number;
    sourceWidth: number;
    sourceHeight: number;
  }>,
): void {
  assertFiniteNumber(options.durationSec, 'Video duration');
  if (options.durationSec <= 0 || options.durationSec > VIDEO_LIMITS.maxDurationSec) {
    throw new Error(`Video duration must be greater than 0 and no more than ${VIDEO_LIMITS.maxDurationSec} seconds.`);
  }
  assertIntegerRange(options.sourceWidth, 'Source width', 1, VIDEO_LIMITS.maxWidth);
  assertIntegerRange(options.sourceHeight, 'Source height', 1, VIDEO_LIMITS.maxHeight);
  if (options.sourceWidth * options.sourceHeight > VIDEO_LIMITS.maxInputPixels) {
    throw new Error('Video dimensions exceed the safe browser processing limit.');
  }

  const start = options.startSec ?? 0;
  const end = options.endSec ?? options.durationSec;
  assertFiniteNumber(start, 'Trim start');
  assertFiniteNumber(end, 'Trim end');
  if (start < 0 || start >= options.durationSec) throw new Error('Trim start is outside the video duration.');
  if (end <= start || end > options.durationSec) throw new Error('Trim end must be greater than start and within the video duration.');

  if (options.crop) {
    const { x, y, width, height } = options.crop;
    assertIntegerRange(x, 'Crop X', 0, VIDEO_LIMITS.maxWidth - 1);
    assertIntegerRange(y, 'Crop Y', 0, VIDEO_LIMITS.maxHeight - 1);
    assertIntegerRange(width, 'Crop width', 1, VIDEO_LIMITS.maxWidth);
    assertIntegerRange(height, 'Crop height', 1, VIDEO_LIMITS.maxHeight);
    if (x + width > options.sourceWidth || y + height > options.sourceHeight) throw new Error('Video crop rectangle exceeds the source bounds.');
  }

  const outputWidth = options.width ?? options.crop?.width ?? options.sourceWidth;
  const outputHeight = options.height ?? options.crop?.height ?? options.sourceHeight;
  assertIntegerRange(outputWidth, 'Output width', 1, VIDEO_LIMITS.maxWidth);
  assertIntegerRange(outputHeight, 'Output height', 1, VIDEO_LIMITS.maxHeight);
  if (outputWidth * outputHeight > VIDEO_LIMITS.maxOutputPixels) throw new Error('Video output dimensions exceed the safe browser processing limit.');

  const fps = options.fps ?? 30;
  assertFiniteNumber(fps, 'FPS');
  if (fps < 1 || fps > VIDEO_LIMITS.maxFps) throw new Error(`FPS must be between 1 and ${VIDEO_LIMITS.maxFps}.`);

  const videoBitrate = options.videoBitsPerSecond ?? 2_500_000;
  const audioBitrate = options.audioBitsPerSecond ?? 128_000;
  assertFiniteNumber(videoBitrate, 'Video bitrate');
  assertFiniteNumber(audioBitrate, 'Audio bitrate');
  if (videoBitrate < 100_000 || videoBitrate > 50_000_000) throw new Error('Video bitrate is outside the safe range.');
  if (audioBitrate < 8_000 || audioBitrate > 512_000) throw new Error('Audio bitrate is outside the safe range.');
}

export function expectedTrimDuration(durationSec: number, startSec = 0, endSec = durationSec): number {
  return Math.max(0, endSec - startSec);
}
