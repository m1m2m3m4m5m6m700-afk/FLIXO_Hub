import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
if (!token || !repo) {
  throw new Error('GOVERNANCE_EVIDENCE_UNAVAILABLE: GH_TOKEN and GITHUB_REPOSITORY are required.');
}

const headers = {
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${token}`,
  'x-github-api-version': '2022-11-28',
  'user-agent': 'FLIXO-governance-verifier',
};

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`GOVERNANCE_API_FAILURE: ${path} -> HTTP ${response.status}`);
  return response.json();
}

const rulesets = await github(`/repos/${repo}/rulesets?per_page=100`);
const candidates = (rulesets ?? []).filter((ruleset) =>
  ruleset.target === 'branch' &&
  ruleset.enforcement === 'active' &&
  ruleset.conditions?.ref_name?.include?.includes('refs/heads/main'),
);
assert.ok(candidates.length > 0, 'an active ruleset targeting refs/heads/main must exist');

let satisfied = null;
const observations = [];
for (const summary of candidates) {
  const ruleset = await github(`/repos/${repo}/rulesets/${summary.id}`);
  const pullRequest = (ruleset.rules ?? []).find((rule) => rule.type === 'pull_request')?.parameters;
  const status = (ruleset.rules ?? []).find((rule) => rule.type === 'required_status_checks')?.parameters;
  const requiredContexts = new Set((status?.required_status_checks ?? []).map((check) => check.context));
  const sourceRestrictionRule = (ruleset.rules ?? []).find((rule) =>
    /source|pull_request.*branch|allowed.*branch/iu.test(rule.type) ||
    Object.keys(rule.parameters ?? {}).some((key) => /source|branch/iu.test(key)),
  );
  observations.push({
    id: ruleset.id,
    name: ruleset.name,
    enforcement: ruleset.enforcement,
    target: ruleset.target,
    requiredApprovals: pullRequest?.required_approving_review_count,
    codeOwnerReview: pullRequest?.require_code_owner_review,
    staleDismissal: pullRequest?.dismiss_stale_reviews_on_push,
    latestPushApproval: pullRequest?.require_last_push_approval,
    threadResolution: pullRequest?.required_review_thread_resolution,
    strictStatusChecks: status?.strict_required_status_checks_policy,
    trustGateRequired: requiredContexts.has('trust-gate'),
    promotionProofRequired: requiredContexts.has('Exact-SHA promotion proof'),
    directSourceRestrictionPresent: Boolean(sourceRestrictionRule),
    bypassActors: ruleset.bypass_actors ?? [],
  });

  const protectedMain = Boolean(
    ruleset.enforcement === 'active' &&
    Array.isArray(ruleset.conditions?.ref_name?.include) &&
    ruleset.conditions.ref_name.include.length === 1 &&
    ruleset.conditions.ref_name.include[0] === 'refs/heads/main' &&
    (ruleset.rules ?? []).some((rule) => rule.type === 'deletion') &&
    (ruleset.rules ?? []).some((rule) => rule.type === 'non_fast_forward'),
  );
  const completeReview = Boolean(
    pullRequest?.required_approving_review_count >= 1 &&
    pullRequest?.dismiss_stale_reviews_on_push === true &&
    pullRequest?.require_code_owner_review === true &&
    pullRequest?.require_last_push_approval === true &&
    pullRequest?.required_review_thread_resolution === true,
  );
  const completeChecks = Boolean(
    status?.strict_required_status_checks_policy === true &&
    requiredContexts.has('trust-gate') &&
    requiredContexts.has('Exact-SHA promotion proof'),
  );
  if (protectedMain && completeReview && completeChecks) satisfied = ruleset;
}

const ci = readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
const sourceRestrictionViaRequiredCheck = Boolean(
  satisfied &&
  /\[\"\$BASE_BRANCH\" = \"main\"\][\s\S]{0,800}\[\"\$HEAD_BRANCH\" != \"execution\"\][\s\S]{0,800}\[\"\$ACTOR\" != \"dependabot\[bot\]\"\]/u.test(ci) ||
  (satisfied && /HEAD_BRANCH.*execution.*dependabot\[bot\]/su.test(ci)),
);

console.log(JSON.stringify({
  MAIN_GOVERNANCE_RULESETS: observations,
  ACTIVE_MAIN_RULESET_ENFORCED: Boolean(satisfied),
  SOURCE_RESTRICTION_DIRECT_RULESET: observations.some((item) => item.directSourceRestrictionPresent),
  SOURCE_RESTRICTION_VIA_REQUIRED_PROMOTION_CHECK: sourceRestrictionViaRequiredCheck,
}, null, 2));

if (!satisfied) {
  throw new Error('MAIN_GOVERNANCE=FAIL_CLOSED: live main ruleset does not satisfy required approval, Code Owner, review, strict-check, protection, and promotion gates.');
}

if (!sourceRestrictionViaRequiredCheck) {
  throw new Error('MAIN_GOVERNANCE=FAIL_CLOSED: required promotion check does not prove allowed main PR source restrictions.');
}

console.log('MAIN_GOVERNANCE=PASS');
console.log(`LIVE_MAIN_RULESET=${satisfied.name}#${satisfied.id}`);
