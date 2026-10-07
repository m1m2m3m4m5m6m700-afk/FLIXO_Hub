import assert from 'node:assert/strict';
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

test('rejects any configured bypass actor', () => {
  const weak = structuredClone(baseRuleset);
  weak.bypass_actors = [{ actor_id: 1, actor_type: 'Integration', bypass_mode: 'always' }];
  const result = validateGovernance(weak, executionRuleset);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('main:bypass-actors'));
});

test('rejects execution when review hardening is incomplete', () => {
  const weak = structuredClone(executionRuleset);
  weak.rules[2].parameters.dismiss_stale_reviews_on_push = false;
  weak.rules[2].parameters.require_code_owner_review = false;
  weak.rules[2].parameters.require_last_push_approval = false;
  weak.rules[2].parameters.required_review_thread_resolution = false;
  weak.rules[3].parameters.strict_required_status_checks_policy = false;
  const result = validateGovernance(baseRuleset, weak);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('execution:dismiss-stale'));
  assert.ok(result.errors.includes('execution:code-owner'));
  assert.ok(result.errors.includes('execution:last-push-approval'));
  assert.ok(result.errors.includes('execution:thread-resolution'));
  assert.ok(result.errors.includes('execution:strict-checks'));
});

test('rejects main when stale approvals or latest-push approval are disabled', () =>
  const weak = structuredClone(baseRuleset);
  weak.rules[2].parameters.dismiss_stale_reviews_on_push = false;
  weak.rules[2].parameters.require_last_push_approval = false;
  const result = validateGovernance(weak, executionRuleset);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('main:dismiss-stale'));
  assert.ok(result.errors.includes('main:last-push-approval'));
});
