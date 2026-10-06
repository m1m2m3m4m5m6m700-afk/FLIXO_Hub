import test from 'node:test';
import assert from 'node:assert/strict';

import { executeCanonicalTool } from '../src/lib/execution/canonical-executor.ts';
import { validateFileSafety, detectZipBombRisk } from '../src/lib/contracts/file-safety.ts';
import { MVP_EXECUTABLE_TOOL_IDS } from '../src/config/manual-capability-definition.ts';

const image = () => new File(['not-a-real-image'], 'fixture.png', { type: 'image/png' });

test('red-team: unknown and non-admitted capabilities are rejected before execution', async () => {
  const file = image();
  await assert.rejects(
    () => executeCanonicalTool('does-not-exist', { blob: file, fileName: file.name }, {}),
    /unknown tool/i,
  );
  await assert.rejects(
    () => executeCanonicalTool('object-remover', { blob: file, fileName: file.name }, {}),
    /not executable|release-ready/i,
  );
  assert.equal(MVP_EXECUTABLE_TOOL_IDS.length, 10);
});

test('red-team: filename traversal, MIME spoofing, magic bytes, and extension mismatch fail closed', () => {
  const basePolicy = {
    allowedMime: ['image/png'],
    allowedExtensions: ['png'],
    maxBytes: 1024,
    signatures: ['png'],
  } as const;

  const traversal = validateFileSafety(
    {
      name: '../payload.png',
      mime: 'image/png',
      bytes: 8,
      signature: '89504e470d0a1a0a',
      content: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    },
    basePolicy,
  );
  assert.equal(traversal.safe, false);
  assert.match(traversal.failures.join('\n'), /single safe relative name/i);

  const spoofed = validateFileSafety(
    {
      name: 'payload.png',
      mime: 'image/png',
      bytes: 8,
      signature: '6e6f742d706e67',
      content: new Uint8Array([0x6e, 0x6f, 0x74, 0x2d, 0x70, 0x6e, 0x67]),
    },
    { ...basePolicy, magicBytes: [{ name: 'PNG', bytes: [0x89, 0x50, 0x4e, 0x47] }] },
  );
  assert.equal(spoofed.safe, false);
  assert.match(spoofed.failures.join('\n'), /signature|magic bytes/i);

  const extensionMismatch = validateFileSafety(
    {
      name: 'payload.jpg',
      mime: 'image/png',
      bytes: 8,
      signature: '89504e470d0a1a0a',
      content: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    },
    basePolicy,
  );
  assert.equal(extensionMismatch.safe, false);
});

test('red-team: archive bomb and deep nesting controls are bounded', () => {
  assert.equal(detectZipBombRisk(100, 5000, 40).isBomb, true);
  assert.equal(detectZipBombRisk(1000, 20000, 40).isBomb, false);
  assert.equal(detectZipBombRisk(0, 1).isBomb, true);
});
