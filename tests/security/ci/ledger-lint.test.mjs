import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { lintLedger } from '../../../scripts/ci/ledger-lint.mjs';

test('active task ledger satisfies the canonical task-card contract', () => {
  const result = lintLedger(readFileSync('المهام.md', 'utf8'));
  assert.equal(result.pass, true, result.failures.join('\n'));
  assert.equal(result.taskCount, 7);
  assert.equal(result.inProgressCount, 0);
});

test('ledger linter fails duplicate IDs and colliding in-progress tasks', () => {
  const source = [
    '# ACTIVE DISPATCH QUEUE',
    '#### EXEC-TEST-001 — one',
    '- **TYPE:** VERIFY',
    '- **PRIORITY:** P1',
    '- **OWNER:** QA',
    '- **STATUS:** IN_PROGRESS',
    '- **SCOPE:** tests',
    '- **DEPENDS_ON:** none',
    '- **SOURCE:** test',
    '- **ACCEPTANCE:** pass',
    '- **EVIDENCE:** none',
    '- **NEXT_ACTION:** run',
    '- **COLLISION_KEY:** shared',
    '',
    '#### EXEC-TEST-001 — duplicate',
    '- **TYPE:** VERIFY',
    '- **PRIORITY:** P1',
    '- **OWNER:** QA',
    '- **STATUS:** IN_PROGRESS',
    '- **SCOPE:** tests',
    '- **DEPENDS_ON:** none',
    '- **SOURCE:** test',
    '- **ACCEPTANCE:** pass',
    '- **EVIDENCE:** none',
    '- **NEXT_ACTION:** run',
    '- **COLLISION_KEY:** shared',
    '',
  ].join('\n');
  const result = lintLedger(source);
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.startsWith('DUPLICATE_TASK_ID:')));
  assert.ok(result.failures.some((failure) => failure.startsWith('IN_PROGRESS_COLLISION:')));
});
