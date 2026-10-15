#!/usr/bin/env node

const REPOSITORY = 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';

async function githubJson(path) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error('FAIL_CLOSED: GH_TOKEN or GITHUB_TOKEN is required.');
  const base = process.env.GITHUB_API_URL || 'https://api.github.com';
  const response = await fetch(base + path, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: 'Bearer ' + token,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'FLIXO-live-governance-verifier',
    },
  });
  if (!response.ok) throw new Error('FAIL_CLOSED: GitHub API ' + response.status + ' for ' + path);
  return response.json();
}

function findRuleset(rulesets, branch) {
  const matching = (rulesets ?? []).filter((ruleset) =>
    ruleset.enforcement === 'active' &&
    ruleset.target === 'branch' &&
    ruleset.conditions?.ref_name?.include?.includes('refs/heads/' + branch)
  );
  if (matching.length === 0) return null;
  return {
    id: matching.map((ruleset) => ruleset.id).join(','),
    name: matching.map((ruleset) => ruleset.name).join(' + '),
    enforcement: 'active',
    target: 'branch',
    conditions: { ref_name: { include: ['refs/heads/' + branch] } },
    rules: matching.flatMap((ruleset) => ruleset.rules ?? []),
    bypass_actors: matching.flatMap((ruleset) => ruleset.bypass_actors ?? []),
  };
}

export function validateGovernance(mainRuleset, executionRuleset) {
  const errors = [];
  if (!mainRuleset) errors.push('main:ruleset-missing');
  if (!executionRuleset) errors.push('execution:ruleset-missing');

  if ((mainRuleset?.bypass_actors ?? []).length > 0) errors.push('main:bypass-actors');
  const mainRules = new Set((mainRuleset?.rules ?? []).map((rule) => rule.type));
  const mainPullRequests = (mainRuleset?.rules ?? []).filter((rule) => rule.type === 'pull_request').map((rule) => rule.parameters ?? {});
  const mainStatusChecks = (mainRuleset?.rules ?? []).filter((rule) => rule.type === 'required_status_checks').map((rule) => rule.parameters ?? {});

  for (const rule of ['deletion', 'non_fast_forward', 'pull_request', 'required_status_checks']) {
    if (!mainRules.has(rule)) errors.push('main:rule-missing:' + rule);
  }
  if (mainPullRequests.length === 0) errors.push('main:pull-request-rule');
  if (Math.max(0, ...mainPullRequests.map((params) => Number(params.required_approving_review_count ?? 0))) < 1) errors.push('main:review-count');
  if (!mainPullRequests.some((params) => params.dismiss_stale_reviews_on_push === true)) errors.push('main:dismiss-stale');
  if (!mainPullRequests.some((params) => params.require_code_owner_review === true)) errors.push('main:code-owner');
  if (!mainPullRequests.some((params) => params.require_last_push_approval === true)) errors.push('main:last-push-approval');
  if (!mainPullRequests.some((params) => params.required_review_thread_resolution === true)) errors.push('main:thread-resolution');
  if (mainStatusChecks.length === 0 || !mainStatusChecks.every((params) => params.strict_required_status_checks_policy === true)) errors.push('main:strict-checks');

  const requiredChecks = new Set(mainStatusChecks.flatMap((params) => (params.required_status_checks ?? []).map((check) => check.context)));
  for (const check of ['trust-gate', 'Exact-SHA promotion proof']) {
    if (!requiredChecks.has(check)) errors.push('main:required-check:' + check);
  }

  if ((executionRuleset?.bypass_actors ?? []).length > 0) errors.push('execution:bypass-actors');
  const executionRules = new Set((executionRuleset?.rules ?? []).map((rule) => rule.type));
  for (const rule of ['deletion', 'non_fast_forward', 'pull_request', 'required_status_checks']) {
    if (!executionRules.has(rule)) errors.push('execution:rule-missing:' + rule);
  }
  const executionPullRequests = (executionRuleset?.rules ?? []).filter((rule) => rule.type === 'pull_request').map((rule) => rule.parameters ?? {});
  const executionStatusChecks = (executionRuleset?.rules ?? []).filter((rule) => rule.type === 'required_status_checks').map((rule) => rule.parameters ?? {});
  if (executionPullRequests.length === 0) errors.push('execution:pull-request-rule');
  if (Math.max(0, ...executionPullRequests.map((params) => Number(params.required_approving_review_count ?? 0))) < 1) errors.push('execution:review-count');
  if (!executionPullRequests.some((params) => params.dismiss_stale_reviews_on_push === true)) errors.push('execution:dismiss-stale');
  if (!executionPullRequests.some((params) => params.require_code_owner_review === true)) errors.push('execution:code-owner');
  if (!executionPullRequests.some((params) => params.require_last_push_approval === true)) errors.push('execution:last-push-approval');
  if (!executionPullRequests.some((params) => params.required_review_thread_resolution === true)) errors.push('execution:thread-resolution');
  if (executionStatusChecks.length === 0 || !executionStatusChecks.every((params) => params.strict_required_status_checks_policy === true)) errors.push('execution:strict-checks');
  const executionRequiredChecks = new Set(executionStatusChecks.flatMap((params) => (params.required_status_checks ?? []).map((check) => check.context)));
  for (const check of ['trust-gate', 'Exact-SHA promotion proof']) {
    if (!executionRequiredChecks.has(check)) errors.push('execution:required-check:' + check);
  }

  return { ok: errors.length === 0, errors };
}

async function main() {
  const rulesets = await githubJson('/repos/' + REPOSITORY + '/rulesets?per_page=100');
  const mainRuleset = findRuleset(rulesets, 'main');
  const executionRuleset = findRuleset(rulesets, 'execution');
  const result = validateGovernance(mainRuleset, executionRuleset);
  if (!result.ok) {
    console.error('LIVE_GOVERNANCE=FAIL');
    for (const error of result.errors) console.error(error);
    process.exit(1);
  }
  console.log('LIVE_GOVERNANCE=PASS');
  console.log('MAIN_RULESET=' + mainRuleset.name);
  console.log('EXECUTION_RULESET=' + executionRuleset.name);
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll('\\', '/'))) await main();
