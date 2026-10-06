#!/usr/bin/env node
import assert from 'node:assert/strict';

const token = process.env.GH_TOKEN?.trim();
const repo = process.env.GITHUB_REPOSITORY?.trim();
const repair = process.env.GOVERNANCE_REPAIR === '1';
const RULESET_ID = 23854302;

if (!token || !repo) throw new Error('GOVERNANCE_REPAIR_EVIDENCE_UNAVAILABLE');
if (!repair) throw new Error('GOVERNANCE_REPAIR_NOT_EXPLICITLY_ENABLED');

const api = `https://api.github.com/repos/${repo}/rulesets/${RULESET_ID}`;
const headers = {
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
  'x-github-api-version': '2022-11-28',
  'user-agent': 'FLIXO-main-governance-repair',
};

const getCurrent = async () => {
  const res = await fetch(api, { headers });
  if (!res.ok) throw new Error(`GOVERNANCE_GET_FAILED_${res.status}`);
  return await res.json();
};

const current = await getCurrent();
assert.equal(current.id, RULESET_ID);
assert.equal(current.name, 'FLIXO-MAIN-PROTECTION');
assert.equal(current.enforcement, 'active');
assert.deepEqual(current.conditions?.ref_name?.include, ['refs/heads/main']);

const rules = structuredClone(current.rules ?? []);
const pull = rules.find((rule) => rule.type === 'pull_request');
const status = rules.find((rule) => rule.type === 'required_status_checks');
assert.ok(pull, 'main pull-request rule missing');
assert.ok(status, 'main required-status-checks rule missing');

const pullParams = pull.parameters ?? {};
const statusParams = status.parameters ?? {};
const contexts = new Set((statusParams.required_status_checks ?? []).map((check) => check.context));

assert.ok(contexts.has('trust-gate'), 'trust-gate requirement missing');
assert.ok(contexts.has('Exact-SHA promotion proof'), 'Exact-SHA promotion proof requirement missing');

const alreadyCompliant =
  pullParams.required_approving_review_count === 1 &&
  pullParams.dismiss_stale_reviews_on_push === true &&
  pullParams.require_code_owner_review === true &&
  pullParams.require_last_push_approval === true &&
  pullParams.required_review_thread_resolution === true &&
  statusParams.strict_required_status_checks_policy === true;

if (!alreadyCompliant) {
  pull.parameters = {
    ...pullParams,
    required_approving_review_count: 1,
    dismiss_stale_reviews_on_push: true,
    require_code_owner_review: true,
    require_last_push_approval: true,
    required_review_thread_resolution: true,
  };
  status.parameters = {
    ...statusParams,
    strict_required_status_checks_policy: true,
  };

  const payload = {
    name: current.name,
    target: current.target,
    enforcement: current.enforcement,
    conditions: current.conditions,
    rules,
    bypass_actors: current.bypass_actors ?? [],
  };

  const put = await fetch(api, { method: 'PUT', headers, body: JSON.stringify(payload) });
  if (!put.ok) throw new Error(`GOVERNANCE_PUT_FAILED_${put.status}`);
}

const verified = await getCurrent();
const vPull = (verified.rules ?? []).find((rule) => rule.type === 'pull_request')?.parameters;
const vStatus = (verified.rules ?? []).find((rule) => rule.type === 'required_status_checks')?.parameters;
assert.equal(vPull?.required_approving_review_count, 1);
assert.equal(vPull?.dismiss_stale_reviews_on_push, true);
assert.equal(vPull?.require_code_owner_review, true);
assert.equal(vPull?.require_last_push_approval, true);
assert.equal(vPull?.required_review_thread_resolution, true);
assert.equal(vStatus?.strict_required_status_checks_policy, true);
assert.deepEqual(
  new Set((vStatus?.required_status_checks ?? []).map((check) => check.context)),
  new Set(['trust-gate', 'Exact-SHA promotion proof']),
);

console.log('MAIN_GOVERNANCE_REPAIR=PASS');
console.log(JSON.stringify({
  rulesetId: verified.id,
  name: verified.name,
  enforcement: verified.enforcement,
  reviewApprovals: vPull.required_approving_review_count,
  dismissStale: vPull.dismiss_stale_reviews_on_push,
  codeOwnerReview: vPull.require_code_owner_review,
  lastPushApproval: vPull.require_last_push_approval,
  reviewThreadsResolved: vPull.required_review_thread_resolution,
  strictStatusChecks: vStatus.strict_required_status_checks_policy,
  requiredChecks: vStatus.required_status_checks.map((x) => x.context),
}, null, 2));
