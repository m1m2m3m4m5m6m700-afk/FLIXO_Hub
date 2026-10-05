import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_REGISTRY } from '../src/config/registry.ts';
import { assertMvpScope } from '../src/lib/contracts/mvp-scope.ts';
import { MVP_EXECUTABLE_TOOL_IDS } from '../src/config/manual-capability-definition.ts';
import { assertReadyToolsHaveOutputContracts } from '../src/lib/contracts/tool-output-contracts.ts';

test('canonical registry satisfies the MVP execution boundary', () => {
  assertMvpScope(TOOL_REGISTRY, MVP_EXECUTABLE_TOOL_IDS);
});

test('every ready capability has exactly one output contract', () => {
  assert.doesNotThrow(() => assertReadyToolsHaveOutputContracts());
});
