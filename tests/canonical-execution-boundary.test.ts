import test from 'node:test';
import assert from 'node:assert/strict';
import { executeCanonicalChain, executeCanonicalTool } from '../src/lib/execution/canonical-executor.ts';

const image = (name = 'input.png', type = 'image/png', size = 4) => new File([new Uint8Array(size)], name, { type });

test('canonical execution rejects unknown tool ids', async () => {
  await assert.rejects(
    () => executeCanonicalTool('does-not-exist', { blob: image(), fileName: 'input.png' }),
    /unknown tool/,
  );
});

test('canonical execution rejects non-executable capabilities', async () => {
  await assert.rejects(
    () => executeCanonicalTool('seed', { blob: image(), fileName: 'input.png' }),
    /not executable/,
  );
});

test('canonical execution rejects invalid parameters before execution', async () => {
  await assert.rejects(
    () => executeCanonicalTool('image-converter', { blob: image(), fileName: 'input.png' }, { format: 'image/tiff' }),
    /Invalid|Expected|received/,
  );
});

test('canonical execution rejects unsafe filenames before execution', async () => {
  await assert.rejects(
    () => executeCanonicalTool('image-converter', { blob: image('../input.png'), fileName: '../input.png' }, { format: 'image/webp' }),
    /file-safety boundary/,
  );
});

test('canonical execution rejects unsupported MIME types before execution', async () => {
  await assert.rejects(
    () => executeCanonicalTool('image-converter', { blob: image('input.txt', 'text/plain'), fileName: 'input.txt' }, { format: 'image/webp' }),
    /file-safety boundary/,
  );
});

test('canonical chain rejects empty and oversized plans closed', async () => {
  await assert.rejects(
    () => executeCanonicalChain([], { blob: image(), fileName: 'input.png' }),
    /between 1 and 8/,
  );
  await assert.rejects(
    () => executeCanonicalChain(Array.from({ length: 9 }, () => ({ toolId: 'image-converter' })), { blob: image(), fileName: 'input.png' }),
    /between 1 and 8/,
  );
});
