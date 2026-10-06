import assert from 'node:assert/strict';

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
if (!token || !repo) {
  throw new Error('GOVERNANCE_EVIDENCE_UNAVAILABLE: GH_TOKEN and GITHUB_REPOSITORY are required.');
}

const response = await fetch(`https://api.github.com/repos/${repo}/rulesets/23854302`, {
  headers: {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'x-github-api-version': '2022-11-28',
    'user-agent': 'FLIXO-governance-verifier',
  },
});
if (!response.ok) throw new Error(`GOVERNANCE_API_FAILURE: HTTP ${response.status}`);
const ruleset = await response.json();

assert.equal(ruleset.enforcement, 'active', 'main ruleset must be active');
assert.deepEqual(ruleset.conditions?.ref_name?.include, ['refs/heads/main'], 'main ruleset target must be main');

const pullRequest = (ruleset.rules ?? []).find((rule) => rule.type === 'pull_request')?.parameters;
assert.ok(pullRequest, 'main ruleset must include a pull-request rule');
assert.equal(pullRequest.required_approving_review_count, 1, 'one approving review is required');
assert.equal(pullRequest.dismiss_stale_reviews_on_push, true, 'stale reviews must be dismissed on push');
assert.equal(pullRequest.require_code_owner_review, true, 'Code Owner review is required');
assert.equal(pullRequest.require_last_push_approval, true, 'latest push approval is required');
assert.equal(pullRequest.required_review_thread_resolution, true, 'review threads must be resolved');

const status = (ruleset.rules ?? []).find((rule) => rule.type === 'required_status_checks')?.parameters;
assert.ok(status, 'main ruleset must include required status checks');
assert.equal(status.strict_required_status_checks_policy, true, 'required status checks must be strict');
const requiredContexts = new Set((status.required_status_checks ?? []).map((check) => check.context));
assert.ok(requiredContexts.has('trust-gate'), 'trust-gate must be required');
assert.ok(requiredContexts.has('Exact-SHA promotion proof'), 'Exact-SHA promotion proof must be required');

console.log('MAIN_GOVERNANCE=PASS');
