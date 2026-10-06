import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MVP_EXECUTABLE_TOOL_IDS } from '../src/config/manual-capability-definition.ts';

const EXPECTED_MVP = Object.freeze([
  'background-remover',
  'image-upscaler',
  'image-cropper',
  'image-compressor',
  'image-converter',
  'image-effects',
  'video-trimmer',
  'video-cropper',
  'video-resizer',
  'video-compressor',
]);

test('repository contains one canonical ten-tool MVP definition with no conflicting twenty-tool release scope', () => {
  assert.deepEqual([...MVP_EXECUTABLE_TOOL_IDS], EXPECTED_MVP);
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const scope = readFileSync(resolve(root, 'docs/MVP-SCOPE-DECISION.md'), 'utf8');
  const plan = readFileSync(resolve(root, 'docs/FLIXO-MVP-EXECUTION-AND-CERTIFICATION-PLAN.md'), 'utf8');
  for (const id of EXPECTED_MVP) {
    assert.ok(scope.includes(id), `scope decision missing ${id}`);
    assert.ok(plan.includes(id), `execution plan missing ${id}`);
  }
  assert.doesNotMatch(scope, /20-tool|twenty-tool|20 executable/iu);
  assert.doesNotMatch(plan, /20-tool|twenty-tool|20 executable/iu);
});
