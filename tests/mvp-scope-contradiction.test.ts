import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MVP_EXECUTABLE_TOOL_IDS, CAPABILITY_DEFINITIONS } from '../src/config/manual-capability-definition.ts';
import { TOOL_REGISTRY } from '../src/config/registry.ts';

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

test('one canonical ten-tool MVP scope is mechanically enforced across authority layers', () => {
  assert.deepEqual([...MVP_EXECUTABLE_TOOL_IDS], EXPECTED_MVP);
  assert.deepEqual(
    CAPABILITY_DEFINITIONS.map((definition) => definition.id),
    EXPECTED_MVP,
  );

  const executableRegistryIds = TOOL_REGISTRY
    .filter((tool) => tool.capability.state === 'EXECUTABLE')
    .map((tool) => tool.id);
  assert.deepEqual(executableRegistryIds, EXPECTED_MVP);

  for (const id of EXPECTED_MVP) {
    const tool = TOOL_REGISTRY.find((candidate) => candidate.id === id);
    assert.ok(tool, `canonical registry missing ${id}`);
    assert.equal(tool?.operational.executorId, id, `executor binding drift for ${id}`);
    assert.equal(tool?.operational.outputContractId, id, `output contract binding drift for ${id}`);
    assert.equal(tool?.executionMode, 'LOCAL', `execution mode drift for ${id}`);
    assert.equal(tool?.requirements.network, false, `network must remain false for ${id}`);
    assert.ok(tool?.parameterSchema, `parameter schema missing for ${id}`);
    assert.ok(tool?.verifier, `verifier missing for ${id}`);
  }

  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const scope = readFileSync(resolve(root, 'docs/MVP-SCOPE-DECISION.md'), 'utf8');
  const plan = readFileSync(resolve(root, 'docs/FLIXO-MVP-EXECUTION-AND-CERTIFICATION-PLAN.md'), 'utf8');
  const claims = readFileSync(resolve(root, 'docs/FLIXO-PUBLIC-CLAIMS-ALLOWLIST.md'), 'utf8');

  for (const id of EXPECTED_MVP) {
    assert.ok(scope.includes(id), `scope decision missing ${id}`);
    assert.ok(plan.includes(id), `execution plan missing ${id}`);
    assert.ok(claims.includes(id), `public claims allowlist missing ${id}`);
  }

  for (const document of [scope, plan, claims]) {
    assert.doesNotMatch(document, /20-tool|twenty-tool|20 executable/iu);
    assert.doesNotMatch(document, /only the six|six canonical executable MVP capabilities/iu);
  }

  assert.match(
    claims,
    /ten canonical executable MVP capabilities/iu,
  );
});
