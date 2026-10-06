import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateMainGovernance } from '../../../scripts/ci/verify-main-ruleset.mjs';
import { classifyRef } from '../../../scripts/ci/verify-branch-policy.mjs';

const relaxedRuleset = {
  id: 23854302,
  enforcement: 'active',
  target: 'branch',
  conditions: { ref_name: { include: ['refs/heads/main'] } },
  rules: [
    { type: 'deletion' },
    { type: 'non_fast_forward' },
    { type: 'pull_request', parameters: {
      required_approving_review_count: 0,
      dismiss_stale_reviews_on_push: false,
      require_code_owner_review: false,
      require_last_push_approval: false,
      required_review_thread_resolution: false
    }},
    { type: 'required_status_checks', parameters: {
      strict_required_status_checks_policy: false,
      required_status_checks: [
        { context: 'trust-gate' },
        { context: 'Exact-SHA promotion proof' }
      ]
    }}
  ]
};

test('FAST governance accepts relaxed development review controls', () => {
  const result = evaluateMainGovernance([relaxedRuleset], 'main', 'fast');
  assert.equal(result.pass, true);
  assert.equal(result.mode, 'fast');
});

test('STRICT governance still rejects relaxed review controls', () => {
  const result = evaluateMainGovernance([relaxedRuleset], 'main', 'strict');
  assert.equal(result.pass, false);
  assert.match(result.failures.join('\n'), /At least one approving review is required/);
});

test('disposable worker branches are allowed', () => {
  for (const ref of [
    'refs/heads/agent-7/runtime-20261006',
    'refs/heads/feature/image-editing',
    'refs/heads/stage/video-validation',
    'refs/heads/redteam/rt-21',
    'refs/heads/task/parallel-fix'
  ]) {
    const result = classifyRef(ref);
    assert.equal(result.allowed, true);
    assert.equal(result.authority, 'working');
  }
});
