import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateAdminExecution } from './execution-policy.ts';

const base = {
  subject: 'authorized-agent',
  capability: 'system.read',
  command: 'git status',
  preview: false,
};

test('authorized execution-lane work is not blocked by approval or rollback prompts', () => {
  const result = evaluateAdminExecution({
    ...base,
    executionClass: 'HIGH_RISK_WRITE',
    target: 'execution',
  });
  assert.deepEqual(result, {
    decision: 'ALLOW_EXECUTION',
    reason: 'authenticated_execution',
    executionClass: 'HIGH_RISK_WRITE',
  });
});

test('execution sub-targets remain autonomous', () => {
  const result = evaluateAdminExecution({
    ...base,
    executionClass: 'DESTRUCTIVE',
    target: 'execution/tests',
  });
  assert.equal(result.decision, 'ALLOW_EXECUTION');
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
