import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertCropRectangle,
  assertEffectParameters,
  assertImageOutputBudget,
  assertImageScale,
  assertSafeRasterInput,
  assertRasterOutput,
  MEDIA_LIMITS,
  readRasterDimensions,
} from '../src/lib/media/media-safety.ts';
import { validateCompressionOptions } from '../src/tools/image-compressor/engine.ts';
import { assertSafeVideoInput, validateVideoRenderOptions } from '../src/lib/video/video-safety.ts';

test('image safety accepts valid PNG header and reads dimensions', async () => {
  const header = Uint8Array.from([
    0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,
    0,0,0,13,0x49,0x48,0x44,0x52,
    0,0,0,0x40,0,0,0,0x20,
  ]);
  const dimensions = readRasterDimensions(header, 'image/png');
  assert.deepEqual(dimensions, { width: 64, height: 32 });
  const bytes = new Uint8Array(100);
  bytes.set(header);
  const input = new Blob([bytes], { type: 'image/png' });
  await assertSafeRasterInput(input);
});

test('image safety rejects MIME/signature mismatch and pixel bombs', async () => {
  const bad = new Blob([new Uint8Array([0xff,0xd8,0xff,0x00])], { type: 'image/png' });
  await assert.rejects(() => assertSafeRasterInput(bad), /signature/);

  const header = Uint8Array.from([
    0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,
    0,0,0,13,0x49,0x48,0x44,0x52,
    0xff,0xff,0xff,0xff,0,0,0,2,
  ]);
  const bytes = new Uint8Array(100);
  bytes.set(header);
  await assert.rejects(() => assertSafeRasterInput(new Blob([bytes], { type: 'image/png' })), /dimensions/);
});

test('image parameter guards reject unsafe or lossy coercion', () => {
  assert.doesNotThrow(() => assertImageScale(2));
  assert.throws(() => assertImageScale(0.5), /at least 1/);
  assert.throws(() => assertImageOutputBudget(5000, 5000), /dimensions/);
  assert.doesNotThrow(() => assertCropRectangle({ x: 2, y: 1, width: 8, height: 5 }, 20, 10));
  assert.throws(() => assertCropRectangle({ x: 15, y: 1, width: 8, height: 5 }, 20, 10), /bounds/);
  assert.doesNotThrow(() => assertEffectParameters('contrast', 120));
  assert.throws(() => assertEffectParameters('contrast', Number.NaN), /between/);
});

test('compressor validates output format, quality, dimensions and target size', () => {
  assert.doesNotThrow(() => validateCompressionOptions({ quality: 0.82, format: 'image/webp', targetSizeKB: 256 }));
  assert.throws(() => validateCompressionOptions({ quality: 2, format: 'image/webp' }), /quality/);
  assert.throws(() => validateCompressionOptions({ quality: 0.8, format: 'image/webp', maxWidth: 0 }), /maxWidth/);
  assert.throws(() => validateCompressionOptions({ quality: 0.8, format: 'image/webp', targetSizeKB: 64 * 1024 + 1 }), /Target size/);
});

test('video safety rejects invalid duration, trim range, crop and resource bounds', () => {
  const valid = {
    durationSec: 10,
    sourceWidth: 320,
    sourceHeight: 180,
    startSec: 1,
    endSec: 5,
    crop: { x: 0, y: 0, width: 320, height: 180 },
    width: 320,
    height: 180,
    fps: 30,
    videoBitsPerSecond: 2_500_000,
    audioBitsPerSecond: 128_000,
  };
  assert.doesNotThrow(() => validateVideoRenderOptions(valid));
  assert.throws(() => validateVideoRenderOptions({ ...valid, endSec: 1 }), /greater than start/);
  assert.throws(() => validateVideoRenderOptions({ ...valid, crop: { ...valid.crop, x: 200, width: 200 } }), /crop rectangle/);
  assert.throws(() => validateVideoRenderOptions({ ...valid, durationSec: MEDIA_LIMITS.videoMaxDurationSec + 1 }), /duration/);
  assert.throws(() => validateVideoRenderOptions({ ...valid, fps: 61 }), /FPS/);
});


test('video safety accepts supported container signatures and rejects mismatches', async () => {
  await assertSafeVideoInput(new Blob([
    Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02]),
  ], { type: 'video/webm' }));
  await assertSafeVideoInput(new Blob([
    Uint8Array.from([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70]),
  ], { type: 'video/mp4' }));
  await assertSafeVideoInput(new Blob([
    Uint8Array.from([0x4f, 0x67, 0x67, 0x53, 0x01]),
  ], { type: 'video/ogg' }));
  await assertSafeVideoInput(new Blob([
    Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0x9a]),
  ], { type: 'video/x-matroska' }));
  await assert.rejects(
    () => assertSafeVideoInput(new Blob([Uint8Array.from([0, 1, 2, 3, 4, 5])], { type: 'video/webm' })),
    /signature/,
  );
});

test('raster output verification rejects wrong MIME/signature', async () => {
  const validPng = new Blob([
    Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,13,0x49,0x48,0x44,0x52]),
  ], { type: 'image/png' });
  await assert.doesNotReject(() => assertRasterOutput(validPng, 'image/png'));
  await assert.rejects(
    () => assertRasterOutput(new Blob([new Uint8Array([1,2,3,4])], { type: 'image/png' }), 'image/png'),
    /signature/,
  );
});
