import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateAdminExecution } from '../../src/server/admin/execution-policy.ts';

const base = {
  subject: 'authorized-agent',
  capability: 'system.read',
  command: 'git status',
  preview: false,
};

test('execution-lane writes remain rollback and approval gated', () => {
  const result = evaluateAdminExecution({
    ...base,
    executionClass: 'HIGH_RISK_WRITE',
    target: 'execution',
  });
  assert.deepEqual(result, {
    decision: 'DENY',
    reason: 'rollback_required',
    executionClass: 'HIGH_RISK_WRITE',
  });
});

test('execution sub-targets do not bypass rollback or approval controls', () => {
  const result = evaluateAdminExecution({
    ...base,
    executionClass: 'DESTRUCTIVE',
    target: 'execution/tests',
  });
  assert.equal(result.decision, 'DENY');
  assert.equal(result.reason, 'rollback_required');
});

test('production/main targets remain approval-gated', () => {
  const result = evaluateAdminExecution({
    ...base,
    executionClass: 'PRODUCTION_CHANGE',
    target: 'main',
  });
  assert.equal(result.decision, 'DENY');
  assert.equal(result.reason, 'rollback_required');
});
