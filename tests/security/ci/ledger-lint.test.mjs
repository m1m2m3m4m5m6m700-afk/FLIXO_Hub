import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { lintLedger } from '../../../scripts/ci/ledger-lint.mjs';

test('active task ledger satisfies the 13-field contract', () => {
  const result = lintLedger(readFileSync('المهام.md', 'utf8'));
  assert.equal(result.pass, true, result.failures.join('\n'));
  assert.equal(result.taskCount, 24);
  assert.equal(result.inProgressCount, 0);
});

test('ledger linter rejects duplicate IDs, invalid dependencies, and owner-action PR values', () => {
  const card = (id, status = 'IN_PROGRESS', pr = 'none', dep = 'none', key = 'shared') => [
    '### ' + id + ' — test',
    '- **TASK_ID:** ' + id,
    '- **TYPE:** VERIFY',
    '- **PRIORITY:** P1',
    '- **OWNER:** QA',
    '- **STATUS:** ' + status,
    '- **PR:** ' + pr,
    '- **SCOPE:** tests',
    '- **DEPENDS_ON:** ' + dep,
    '- **SOURCE:** test',
    '- **EVIDENCE:** none',
    '- **ACCEPTANCE:** pass',
    '- **NEXT_ACTION:** run',
    '- **COLLISION_KEY:** ' + key,
    '',
  ].join('\n');

  const source = [
    '# ACTIVE DISPATCH QUEUE',
    '**ACTIVE TASK COUNT:** 3',
    card('EXEC-TEST-001'),
    card('EXEC-TEST-001'),
    card('EXEC-OWNER-002', 'OWNER_ACTION', 'none'),
    card('EXEC-TEST-003', 'QUEUED', 'none', 'EXEC-MISSING-001', 'other'),
    '# END ACTIVE DISPATCH QUEUE',
  ].join('\n');

  const result = lintLedger(source);
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((f) => f === 'DUPLICATE_TASK_ID'));
  assert.ok(result.failures.some((f) => f.startsWith('IN_PROGRESS_COLLISION:')));
  assert.ok(result.failures.some((f) => f.startsWith('EXEC-OWNER-002:OWNER_ACTION_PR_MUST_BE_NA')));
  assert.ok(result.failures.some((f) => f.startsWith('EXEC-TEST-003:MISSING_DEPENDENCY:')));
});
