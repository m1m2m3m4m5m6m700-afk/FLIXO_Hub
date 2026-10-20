import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateGovernance } from '../../../scripts/ci/verify-live-governance.mjs';

const baseRuleset = {
  enforcement: 'active',
  target: 'branch',
  conditions: { ref_name: { include: ['refs/heads/main'] } },
  rules: [
    { type: 'deletion' },
    { type: 'non_fast_forward' },
    { type: 'pull_request', parameters: {
      required_approving_review_count: 1,
      dismiss_stale_reviews_on_push: true,
      require_code_owner_review: true,
      require_last_push_approval: true,
      required_review_thread_resolution: true,
    }},
    { type: 'required_status_checks', parameters: {
      strict_required_status_checks_policy: true,
      required_status_checks: [{ context: 'trust-gate' }, { context: 'Exact-SHA promotion proof' }],
    }},
  ],
};

const executionRuleset = {
  ...baseRuleset,
  conditions: { ref_name: { include: ['refs/heads/execution'] } },
};

test('accepts strict main and execution governance', () => {
  assert.deepEqual(validateGovernance(baseRuleset, executionRuleset), { ok: true, errors: [] });
});

test('rejects main when stale approvals or latest-push approval are disabled', () => {
  const weak = structuredClone(baseRuleset);
  weak.rules[2].parameters.dismiss_stale_reviews_on_push = false;
  weak.rules[2].parameters.require_last_push_approval = false;
  const result = validateGovernance(weak, executionRuleset);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('main:dismiss-stale'));
  assert.ok(result.errors.includes('main:last-push-approval'));
});


test('autonomous promotion controller verifies the protected PR without merging or enabling auto-merge', async () => {
  const workflow = await readFile(new URL('../../../.github/workflows/autonomous-promotion.yml', import.meta.url), 'utf8');
  assert.ok(workflow.includes('bash scripts/ci/check-governance.sh'));
  assert.ok(workflow.includes('Record protected promotion state without merging'));
  assert.ok(workflow.includes('WAITING_FOR_PROTECTED_REVIEW_AND_REQUIRED_CHECKS'));
  assert.ok(workflow.includes('headRefOid'));
  assert.equal(workflow.includes('gh pr merge'), false);
  assert.equal(workflow.includes('AUTO_MERGE_ENABLED=true'), false);
});
