import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

const REQUIRED_AGENT_RUNTIME_FILES = [
  'packages/agent-runtime/package.json',
  'packages/agent-runtime/src/index.ts',
  'src/lib/agent/capability-registry.ts',
  'src/lib/agent/execution-gate.ts',
  'src/lib/agent/approval-policy.ts',
  'src/lib/agent/visual-goal-verifier.ts',
  'api/flixo-agent.ts',
] as const;

test('red-team release gate requires the canonical Agent runtime and execution surface', () => {
  const missing = REQUIRED_AGENT_RUNTIME_FILES.filter((path) => !existsSync(path));
  assert.deepEqual(missing, [], [
    'Agent runtime is required for Natural Language -> Planner -> Selection -> Plan -> Confirmation -> Executor -> Verifier certification.',
    `Missing: ${missing.join(', ')}`,
  ].join('\n'));
});
