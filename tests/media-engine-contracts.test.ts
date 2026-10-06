import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  validateVideoInput,
  validateVideoRenderOptions,
} = await import('../src/lib/video/video-executor.ts');
const {
  validateImageEngineInput,
  validateImageDimensions,
} = await import('../src/tools/image-toolkit/engine.ts');
const {
  validateCompressionOptions,
} = await import('../src/tools/image-compressor/file-safety.ts');

test('video input validation accepts signed WebM and rejects malformed containers', async () => {
  await validateVideoInput(new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x00])], { type: 'video/webm' }));
  await assert.rejects(() => validateVideoInput(new Blob(['not-video'], { type: 'video/webm' })), /VIDEO_INPUT_SIGNATURE_INVALID/);
  await assert.rejects(() => validateVideoInput(new Blob(['data'], { type: 'application/octet-stream' })), /VIDEO_INPUT_UNSUPPORTED_MIME/);
});

test('video render validation enforces trim, crop, dimension, fps and bitrate bounds', () => {
  const metadata = { width: 320, height: 180, duration: 10 };
  validateVideoRenderOptions(metadata, {});
  validateVideoRenderOptions(metadata, { startSec: 2, endSec: 8 });
  validateVideoRenderOptions(metadata, { crop: { x: 0, y: 0, width: 160, height: 90 } });
  validateVideoRenderOptions(metadata, { width: 640, height: 360, fps: 60, videoBitsPerSecond: 2_000_000 });

  assert.throws(() => validateVideoRenderOptions(metadata, { startSec: 8, endSec: 8 }), /VIDEO_TRIM_RANGE_INVALID/);
  assert.throws(() => validateVideoRenderOptions(metadata, { startSec: 0, endSec: 10.1 }), /VIDEO_TRIM_RANGE_INVALID/);
  assert.throws(() => validateVideoRenderOptions(metadata, { crop: { x: 200, y: 0, width: 160, height: 90 } }), /VIDEO_CROP_BOUNDS_INVALID/);
  assert.throws(() => validateVideoRenderOptions(metadata, { width: 8001, height: 180 }), /VIDEO_OUTPUT_DIMENSIONS_INVALID/);
  assert.throws(() => validateVideoRenderOptions(metadata, { fps: 121 }), /VIDEO_FPS_INVALID/);
  assert.throws(() => validateVideoRenderOptions(metadata, { videoBitsPerSecond: 50_000_001 }), /VIDEO_VIDEO_BITRATE_INVALID/);
});

test('image engine rejects unsupported blobs and unsafe dimensions', () => {
  assert.throws(() => validateImageEngineInput(new Blob([], { type: 'image/png' })), /IMAGE_INPUT_EMPTY/);
  assert.throws(() => validateImageEngineInput(new Blob(['x'], { type: 'image/svg+xml' })), /IMAGE_INPUT_UNSUPPORTED_MIME/);
  validateImageDimensions(4000, 4000);
  assert.throws(() => validateImageDimensions(8000, 2001), /IMAGE_PIXELS_EXCEEDED/);
  assert.throws(() => validateImageDimensions(8001, 1), /IMAGE_DIMENSIONS_INVALID/);
});

test('image compressor validates every declared option instead of silently coercing it', () => {
  validateCompressionOptions({ quality: 0.8, format: 'image/webp', maxWidth: 1200, maxHeight: 1200, targetSizeKB: 256 });
  assert.throws(() => validateCompressionOptions({ quality: 0, format: 'image/webp' }), /Invalid compression quality/);
  assert.throws(() => validateCompressionOptions({ quality: 0.8, format: 'image/avif' as never }), /Unsupported compression output format/);
  assert.throws(() => validateCompressionOptions({ quality: 0.8, format: 'image/png', maxWidth: 0 }), /Invalid compression maxWidth/);
  assert.throws(() => validateCompressionOptions({ quality: 0.8, format: 'image/png', targetSizeKB: 64 * 1024 + 1 }), /Invalid compression target size/);
});
