import assert from 'node:assert/strict';
import test from 'node:test';
import { runStoredToolChain } from '../src/lib/tool-chain-runner.ts';

test('rejects unknown tool names before adapter dispatch', async () => {
  await assert.rejects(
    runStoredToolChain(['forged-tool'], { blob: new Blob(['x'], { type: 'image/png' }), fileName: 'x.png' }),
    /not registered in the canonical registry/i,
  );
});

test('rejects PLANNABLE tools before adapter dispatch', async () => {
  await assert.rejects(
    runStoredToolChain(['image-rotate'], { blob: new Blob(['x'], { type: 'image/png' }), fileName: 'x.png' }),
    /not executable in the canonical registry/i,
  );
});

test('rejects non-Blob execution input before adapter dispatch', async () => {
  await assert.rejects(
    runStoredToolChain(['image-converter'], { blob: null as unknown as Blob, fileName: 'x.png' }),
    /input must contain a Blob/i,
  );
});
