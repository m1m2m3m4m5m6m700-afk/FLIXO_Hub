import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attachVideoBlobSource } from '../src/lib/video/blob-video-source.ts';
import {
  assertSafeVideoInput,
  validateVideoRenderOptions,
  VIDEO_LIMITS,
} from '../src/lib/video/video-safety.ts';
import { getToolOutputContract } from '../src/lib/contracts/tool-output-contracts.ts';
import { assertToolOutputContract } from '../src/lib/contracts/tool-output.ts';
import { runBoundedExecutionAttempts } from '../src/lib/execution/canonical-executor.ts';

test('video input boundary rejects empty, MIME spoof, magic mismatch and oversized input', async () => {
  await assert.rejects(
    () => assertSafeVideoInput(new Blob([], { type: 'video/webm' })),
    /empty/i,
  );
  await assert.rejects(
    () => assertSafeVideoInput(new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], { type: 'video/webm' })),
    /signature/i,
  );
  await assert.rejects(
    () => assertSafeVideoInput(new Blob([Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3])], { type: 'image/png' })),
    /unsupported video format/i,
  );

  const oversized = {
    size: VIDEO_LIMITS.maxInputBytes + 1,
    type: 'video/webm',
    slice: () => new Blob([Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3])]),
  } as unknown as Blob;
  await assert.rejects(() => assertSafeVideoInput(oversized), /512 MB|exceeds/i);
});

test('video render boundaries reject duration, dimensions, crop, output, FPS and bitrate abuse', () => {
  const base = {
    durationSec: 10,
    sourceWidth: 320,
    sourceHeight: 180,
    startSec: 0,
    endSec: 5,
    width: 160,
    height: 90,
    fps: 30,
    videoBitsPerSecond: 2_500_000,
    audioBitsPerSecond: 64_000,
  };
  assert.doesNotThrow(() => validateVideoRenderOptions(base));
  assert.throws(() => validateVideoRenderOptions({ ...base, durationSec: VIDEO_LIMITS.maxDurationSec + 1 }), /duration/i);
  assert.throws(() => validateVideoRenderOptions({ ...base, sourceWidth: VIDEO_LIMITS.maxWidth + 1 }), /Source width/i);
  assert.throws(() => validateVideoRenderOptions({ ...base, sourceWidth: 9000, sourceHeight: 9000 }), /Source width|pixel/i);
  assert.throws(() => validateVideoRenderOptions({ ...base, crop: { x: 300, y: 0, width: 100, height: 90 } }), /crop rectangle/i);
  assert.throws(() => validateVideoRenderOptions({ ...base, width: VIDEO_LIMITS.maxWidth + 1 }), /Output width/i);
  assert.throws(() => validateVideoRenderOptions({ ...base, fps: VIDEO_LIMITS.maxFps + 1 }), /FPS/i);
  assert.throws(() => validateVideoRenderOptions({ ...base, videoBitsPerSecond: 50_000_001 }), /bitrate/i);
});

test('output contract rejects spoofed signature and oversized artifacts', () => {
  const contract = getToolOutputContract('video-compressor');
  assert.ok(contract);
  assert.doesNotThrow(() => assertToolOutputContract(contract!, {
    mimeType: 'video/webm',
    byteLength: 4,
    bytes: Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]),
    filename: 'compressed.webm',
    dimensions: { width: 320, height: 180 },
  }));
  assert.throws(() => assertToolOutputContract(contract!, {
    mimeType: 'video/webm',
    byteLength: 4,
    bytes: Uint8Array.from([0, 1, 2, 3]),
    filename: 'compressed.webm',
    dimensions: { width: 320, height: 180 },
  }), /signature/i);
  assert.throws(() => assertToolOutputContract(contract!, {
    mimeType: 'video/webm',
    byteLength: 512 * 1024 * 1024 + 1,
    bytes: Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]),
    filename: 'compressed.webm',
    dimensions: { width: 320, height: 180 },
  }), /maximum|above|size/i);
});

test('Blob source cleanup revokes URL on abort and repeated cleanup is idempotent', async () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let revoked = 0;
  URL.createObjectURL = (() => 'blob:test-source') as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => { revoked += 1; }) as typeof URL.revokeObjectURL;

  class FakeVideo {
    src = '';
    removeAttribute() { this.src = ''; }
    load() {}
  }

  try {
    const controller = new AbortController();
    const video = new FakeVideo() as unknown as HTMLVideoElement;
    const cleanup = await attachVideoBlobSource(video, new Blob([Uint8Array.from([1, 2, 3])], { type: 'video/webm' }), controller.signal);
    assert.equal(video.src, 'blob:test-source');
    controller.abort();
    cleanup();
    cleanup();
    assert.equal(video.src, '');
    assert.equal(revoked, 1);
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});

test('canonical bounded attempts retry non-abort failures and stop immediately on abort', async () => {
  let attempts = 0;
  const value = await runBoundedExecutionAttempts(3, async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('transient');
    return 'ok';
  });
  assert.equal(value, 'ok');
  assert.equal(attempts, 3);

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => runBoundedExecutionAttempts(3, async () => 'should-not-run', controller.signal),
    /cancelled|aborted/i,
  );
});
