import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MVP_EXECUTABLE_TOOL_IDS, CAPABILITY_DEFINITIONS } from '../src/config/manual-capability-definition.ts';
import { FLIXO_MVP_SCOPE } from '../src/lib/contracts/mvp-scope.ts';
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

const sorted = (ids: readonly string[]) => [...ids].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'variant' }));

test('one canonical ten-tool MVP scope is mechanically enforced across authority layers', () => {
  assert.deepEqual(sorted(MVP_EXECUTABLE_TOOL_IDS), sorted(EXPECTED_MVP));
  assert.equal(new Set(MVP_EXECUTABLE_TOOL_IDS).size, EXPECTED_MVP.length);
  assert.deepEqual(
    sorted(CAPABILITY_DEFINITIONS.map((definition) => definition.id)),
    sorted(EXPECTED_MVP),
  );
  assert.equal(
    new Set(CAPABILITY_DEFINITIONS.map((definition) => definition.id)).size,
    EXPECTED_MVP.length,
  );

  const executableRegistryIds = TOOL_REGISTRY
    .filter((tool) => tool.capability.state === 'EXECUTABLE')
    .map((tool) => tool.id);
  assert.deepEqual(sorted(executableRegistryIds), sorted(EXPECTED_MVP));
  assert.equal(new Set(executableRegistryIds).size, EXPECTED_MVP.length);

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
  const directive = readFileSync(resolve(root, 'GPT'), 'utf8');
  const claims = readFileSync(resolve(root, 'docs/FLIXO-PUBLIC-CLAIMS-ALLOWLIST.md'), 'utf8');

  assert.equal(FLIXO_MVP_SCOPE.workflow.agentGuided, false);
  assert.equal(FLIXO_MVP_SCOPE.workflow.manualStandalone, true);
  assert.equal(FLIXO_MVP_SCOPE.processing.executionLocation, 'BROWSER_ONLY');
  assert.equal(FLIXO_MVP_SCOPE.processing.userFileBytesMayCrossNetwork, false);
  assert.match(directive, /FLIXO Manual-Only Product Directive/u);
  assert.match(directive, /No public or internal AI agent runtime/u);

  for (const id of EXPECTED_MVP) {
    assert.ok(claims.includes(id), `public claims allowlist missing ${id}`);
  }

  for (const document of [directive, claims]) {
    assert.doesNotMatch(document, /20-tool|twenty-tool|20 executable/iu);
    assert.doesNotMatch(document, /only the six|six canonical executable MVP capabilities/iu);
  }

  assert.match(claims, /ten canonical executable MVP capabilities/iu);
});
