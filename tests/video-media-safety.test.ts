import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  assertSafeVideoInput,
  expectedTrimDuration,
  validateVideoRenderOptions,
  VIDEO_LIMITS,
} from '../src/lib/video/video-safety.ts';

const webm = (bytes: number[]) => new Blob([Uint8Array.from(bytes)], { type: 'video/webm' });

test('video safety rejects empty, MIME-spoofed, magic-mismatched, and oversized inputs', async () => {
  await assert.rejects(
    () => assertSafeVideoInput(new Blob([], { type: 'video/webm' })),
    /empty/i,
  );
  await assert.rejects(
    () => assertSafeVideoInput(new Blob([Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 1])], { type: 'video/mp4' })),
    /signature|format/i,
  );
  await assert.rejects(
    () => assertSafeVideoInput(webm([0, 1, 2, 3, 4])),
    /signature/i,
  );

  const oversized = webm([0x1a, 0x45, 0xdf, 0xa3, 1]);
  Object.defineProperty(oversized, 'size', { value: VIDEO_LIMITS.maxInputBytes + 1 });
  await assert.rejects(
    () => assertSafeVideoInput(oversized),
    /512 MB|size/i,
  );
});

test('video safety rejects excessive duration, dimensions, crop, output, fps, and bitrate', () => {
  const valid = {
    durationSec: 12,
    sourceWidth: 320,
    sourceHeight: 180,
    startSec: 1,
    endSec: 5,
    crop: { x: 20, y: 10, width: 200, height: 100 },
    width: 640,
    height: 360,
    fps: 30,
    videoBitsPerSecond: 2_500_000,
    audioBitsPerSecond: 128_000,
  };
  assert.doesNotThrow(() => validateVideoRenderOptions(valid));
  assert.throws(() => validateVideoRenderOptions({ ...valid, durationSec: VIDEO_LIMITS.maxDurationSec + 0.01 }), /duration/i);
  assert.throws(() => validateVideoRenderOptions({ ...valid, sourceWidth: 9000 }), /Source width/i);
  assert.throws(() => validateVideoRenderOptions({ ...valid, width: 9000 }), /Output width/i);
  assert.throws(() => validateVideoRenderOptions({ ...valid, crop: { ...valid.crop, x: 200, width: 200 } }), /crop rectangle/i);
  assert.throws(() => validateVideoRenderOptions({ ...valid, fps: 121 }), /FPS/i);
  assert.throws(() => validateVideoRenderOptions({ ...valid, videoBitsPerSecond: 99_999 }), /bitrate|range/i);
});

test('video safety rejects invalid trim ranges and computes semantic trim duration', () => {
  const valid = {
    durationSec: 10,
    sourceWidth: 320,
    sourceHeight: 180,
  };
  assert.throws(() => validateVideoRenderOptions({ ...valid, startSec: 9, endSec: 9 }), /greater than start/i);
  assert.throws(() => validateVideoRenderOptions({ ...valid, startSec: 11, endSec: 12 }), /outside/i);
  assert.throws(() => validateVideoRenderOptions({ ...valid, startSec: 2, endSec: 11 }), /within/i);
  assert.equal(expectedTrimDuration(10, 2, 7), 5);
});

test('video renderer has explicit terminal guards for recorder failure, empty output, output size, abort, timeout, cleanup, and compression', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const source = readFileSync(resolve(root, 'src/lib/video/video-executor.ts'), 'utf8');

  assert.match(source, /const operationController = new AbortController\(\)/u);
  assert.match(source, /setTimeout\(\(\) => operationController\.abort\(\), VIDEO_LIMITS\.timeoutMs\)/u);
  assert.match(source, /options\.signal\?\.addEventListener\('abort', abortFromCaller/u);
  assert.match(source, /totalOutputBytes \+= event\.data\.size/u);
  assert.match(source, /VIDEO_OUTPUT_TOO_LARGE/u);
  assert.match(source, /VIDEO_RECORDING_FAILED/u);
  assert.match(source, /VIDEO_RECORDING_EMPTY/u);
  assert.match(source, /VIDEO_COMPRESSION_NOT_REDUCED/u);
  assert.match(source, /canvasStream\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/u);
  assert.match(source, /sourceStream\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/u);
  assert.match(source, /releaseSource\?\.\(\)/u);
  assert.match(source, /if \(video\.parentNode\) video\.parentNode\.removeChild\(video\)/u);
  assert.match(source, /await assertWebmArtifact\(output\)/u);
});

test('video legacy executor surface is absent and active UI remains canonical', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  assert.equal(existsSync(resolve(root, 'src/lib/video/video-tool-executors.ts')), false);
  const ui = readFileSync(resolve(root, 'src/tools/video-local/index.tsx'), 'utf8');
  assert.match(ui, /executeCanonicalTool\(id/u);
  assert.doesNotMatch(ui, /video-tool-executors/u);
});
