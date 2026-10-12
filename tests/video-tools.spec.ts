import assert from 'node:assert/strict';
import test from 'node:test';

// This Node-level suite checks the fail-closed runtime boundary only.
// Successful video processing is exercised by the official Playwright suite,
// which creates a real WebM fixture inside the browser.
process.env.SITE_URL ??= 'https://flixoai.m1m2m3m4m5m6m700.workers.dev';
process.env.VITE_SITE_URL ??= process.env.SITE_URL;

const { executeCanonicalTool } = await import('../src/lib/execution/canonical-executor.ts');

const videoCases = [
  {
    id: 'video-trimmer',
    parameters: { startSec: 0, endSec: 1 },
  },
  {
    id: 'video-cropper',
    parameters: { x: 20, y: 10, width: 100, height: 80 },
  },
  {
    id: 'video-resizer',
    parameters: { width: 1280, height: 720 },
  },
  {
    id: 'video-compressor',
    parameters: { videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 64_000 },
  },
] as const;

function makeWebmSignatureProbe(): Blob {
  // Only the signature is needed to reach the non-browser runtime guard.
  // This is deliberately not represented as a decodable WebM media fixture.
  return new Blob([Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00])], {
    type: 'video/webm',
  });
}

test('all four canonical video tools fail closed outside a browser runtime', async () => {
  const blob = makeWebmSignatureProbe();

  for (const videoCase of videoCases) {
    await assert.rejects(
      () => executeCanonicalTool(videoCase.id, { blob, fileName: 'runtime-boundary.webm' }, videoCase.parameters),
      /VIDEO_BROWSER_RUNTIME_REQUIRED/u,
      videoCase.id,
    );
  }
});

test('video execution rejects a missing blob with an explicit denial', async () => {
  await assert.rejects(
    () => executeCanonicalTool(
      'video-trimmer',
      { blob: null as unknown as Blob, fileName: 'missing.webm' },
      { startSec: 0, endSec: 1 },
    ),
    /Execution denied: input blob is missing or invalid/u,
  );
});

test('video execution rejects an invalid media signature before browser processing', async () => {
  const invalidBlob = new Blob([Uint8Array.from([0x00, 0x01, 0x02, 0x03, 0x04])], {
    type: 'video/webm',
  });

  await assert.rejects(
    () => executeCanonicalTool(
      'video-trimmer',
      { blob: invalidBlob, fileName: 'invalid.webm' },
      { startSec: 0, endSec: 1 },
    ),
    /Execution denied by file-safety boundary:.*signature/u,
  );
});

test('video capability schemas reject malformed parameters before media processing', async (t) => {
  const blob = makeWebmSignatureProbe();
  const invalidCases = [
    { id: 'video-cropper', parameters: { crop: { x: 1, y: 2, width: 10, height: 10 }, width: 128, height: 72 } },
    { id: 'video-resizer', parameters: { width: 9000, height: 9000 } },
    { id: 'video-compressor', parameters: { videoBitsPerSecond: 99_999_999 } },
  ] as const;

  for (const invalidCase of invalidCases) {
    await t.test(invalidCase.id, async () => {
      await assert.rejects(
        () => executeCanonicalTool(
          invalidCase.id,
          { blob, fileName: 'parameters.webm' },
          invalidCase.parameters,
        ),
        /Invalid parameters for manual capability/u,
      );
    });
  }
});
