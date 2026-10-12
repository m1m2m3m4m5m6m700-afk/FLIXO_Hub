import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeCanonicalTool } from '@/lib/execution/canonical-executor';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = resolve(root, 'tests', 'video', 'fixtures');
mkdirSync(fixturesDir, { recursive: true });

function makeWebmFixture(): Blob {
  // Build a small synthetic WebM/EBML file with a deterministic byte pattern.
  const header = new Uint8Array(64);
  // EBML signature
  header[0] = 0x1a; header[1] = 0x45; header[2] = 0xdf; header[3] = 0xa3;
  // Fill with a deterministic pattern
  for (let i = 0; i < header.length; i++) {
    header[i] = i % 251;
  }
  // Add minimal EBML structure elements
  const elems = [
    { id: 0x4286, value: 1 },   // EBMLVersion
    { id: 0x42f7, value: 4 },   // EBMLReadVersion
    { id: 0x42f2, value: 255 }, // EBMLMaxIDLength
    { id: 0x42f3, value: 8 },   // EBMLMaxSizeLength
    { id: 0x4282, value: 1 },   // DocType
    { id: 0x4287, value: 1 },   // DocTypeVersion
    { id: 0x4285, value: 2 },   // DocTypeReadVersion
  ];
  let offset = 64;
  for (const elem of elems) {
    header[offset++] = (elem.id >> 24) & 0xff;
    header[offset++] = (elem.id >> 16) & 0xff;
    header[offset++] = (elem.id >> 8) & 0xff;
    header[offset++] = elem.id & 0xff;
    for (let i = 0; i < 4; i++) {
      header[offset++] = (elem.value >> (8 * (3 - i))) & 0xff;
    }
  }
  return new Blob([header], { type: 'video/webm' });
}

describe('video-trimmer', () => {
  const toolId = 'video-trimmer';
  const safeInput = makeWebmFixture();

  it('succeeds on valid trim parameters', async () => {
    const parameters = { startSec: 0, endSec: 1 };
    const output = await executeCanonicalTool(toolId, { blob: safeInput, fileName: 'test.webm' }, parameters);
    assert.ok(output.blob instanceof Blob);
    assert.ok(output.fileName.length > 0);
    assert.equal(output.blob.type, 'video/webm');
  });

  it('rejects missing input blob', async () => {
    await assert.rejects(
      () => executeCanonicalTool(toolId, { blob: null as unknown as Blob, fileName: 'test.webm' }, { startSec: 0, endSec: 1 }),
      /Execution denied/i,
    );
  });

  it('rejects invalid trim range', async () => {
    await assert.rejects(
      () => executeCanonicalTool(toolId, { blob: safeInput, fileName: 'test.webm' }, { startSec: 5, endSec: 1 }),
      /Execution denied/i,
    );
  });

  it('rejects unsupported MIME', async () => {
    const invalid = new Blob([], { type: 'application/octet-stream' });
    await assert.rejects(
      () => executeCanonicalTool(toolId, { blob: invalid, fileName: 'test.bin' }, { startSec: 0, endSec: 1 }),
      /Execution denied/i,
    );
  });
});

describe('video-cropper', () => {
  const toolId = 'video-cropper';
  const safeInput = makeWebmFixture();

  it('succeeds on valid crop parameters', async () => {
    const parameters = { crop: { x: 20, y: 10, width: 100, height: 80 }, width: 1280, height: 720 };
    const output = await executeCanonicalTool(toolId, { blob: safeInput, fileName: 'test.webm' }, parameters);
    assert.ok(output.blob instanceof Blob);
    assert.ok(output.fileName.length > 0);
    assert.equal(output.blob.type, 'video/webm');
  });

  it('rejects crop rectangle outside source bounds', async () => {
    await assert.rejects(
      () => executeCanonicalTool(toolId, { blob: safeInput, fileName: 'test.webm' }, { crop: { x: 500, y: 0, width: 100, height: 80 }, width: 1280, height: 720 }),
      /Execution denied/i,
    );
  });

  it('rejects negative crop coordinate', async () => {
    await assert.rejects(
      () => executeCanonicalTool(toolId, { blob: safeInput, fileName: 'test.webm' }, { crop: { x: -10, y: 0, width: 100, height: 80 }, width: 1280, height: 720 }),
      /Execution denied/i,
    );
  });
});

describe('video-resizer', () => {
  const toolId = 'video-resizer';
  const safeInput = makeWebmFixture();

  it('succeeds on valid resize parameters', async () => {
    const parameters = { width: 1280, height: 720 };
    const output = await executeCanonicalTool(toolId, { blob: safeInput, fileName: 'test.webm' }, parameters);
    assert.ok(output.blob instanceof Blob);
    assert.ok(output.fileName.length > 0);
    assert.equal(output.blob.type, 'video/webm');
  });

  it('rejects output dimensions exceeding safety limit', async () => {
    await assert.rejects(
      () => executeCanonicalTool(toolId, { blob: safeInput, fileName: 'test.webm' }, { width: 9000, height: 9000 }),
      /Execution denied/i,
    );
  });

  it('rejects missing required parameters', async () => {
    await assert.rejects(
      () => executeCanonicalTool(toolId, { blob: safeInput, fileName: 'test.webm' }, {}),
      /Validation error/i,
    );
  });
});

describe('video-compressor', () => {
  const toolId = 'video-compressor';
  const safeInput = makeWebmFixture();

  it('succeeds on valid compression parameters', async () => {
    const parameters = { videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 64_000 };
    const output = await executeCanonicalTool(toolId, { blob: safeInput, fileName: 'test.webm' }, parameters);
    assert.ok(output.blob instanceof Blob);
    assert.ok(output.fileName.length > 0);
    assert.equal(output.blob.type, 'video/webm');
  });

  it('rejects excessive bitrate', async () => {
    await assert.rejects(
      () => executeCanonicalTool(toolId, { blob: safeInput, fileName: 'test.webm' }, { videoBitsPerSecond: 99_999_999 }),
      /Execution denied/i,
    );
  });
});
