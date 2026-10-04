import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

const REQUIRED_CANONICAL_AGENT_SURFACE = [
  'src/lib/image-agent-workflow.ts',
  'src/lib/canonical-image-executor.ts',
  'src/config/registry.ts',
  'src/config/manual-capability-definition.ts',
  'src/lib/contracts/ai-plan.ts',
  'src/lib/intent-router.ts',
] as const;

test('red-team release gate requires the canonical Agent planning and execution surface', () => {
  const missing = REQUIRED_CANONICAL_AGENT_SURFACE.filter((path) => !existsSync(path));
  assert.deepEqual(missing, [], [
    'Agent runtime is required for Natural Language -> Planner -> Selection -> Plan -> Confirmation -> Executor -> Verifier certification.',
    'The release gate must point at the canonical image-agent workflow, registry, plan contract, and canonical executor rather than a second runtime or second registry.',
    `Missing: ${missing.join(', ')}`,
  ].join('\n'));
});
