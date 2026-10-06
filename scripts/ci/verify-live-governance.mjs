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
  return rulesets.find((ruleset) =>
    ruleset.enforcement === 'active' &&
    ruleset.target === 'branch' &&
    ruleset.conditions?.ref_name?.include?.includes('refs/heads/' + branch)
  );
}

export function validateGovernance(mainRuleset, executionRuleset) {
  const errors = [];
  if (!mainRuleset) errors.push('main:ruleset-missing');
  if (!executionRuleset) errors.push('execution:ruleset-missing');

  const mainRules = new Set((mainRuleset?.rules ?? []).map((rule) => rule.type));
  const mainPullRequest = mainRuleset?.rules?.find((rule) => rule.type === 'pull_request')?.parameters ?? {};
  const mainChecks = mainRuleset?.rules?.find((rule) => rule.type === 'required_status_checks')?.parameters ?? {};

  for (const rule of ['deletion', 'non_fast_forward', 'pull_request', 'required_status_checks']) {
    if (!mainRules.has(rule)) errors.push('main:rule-missing:' + rule);
  }
  if (Number(mainPullRequest.required_approving_review_count) < 1) errors.push('main:review-count');
  if (mainPullRequest.dismiss_stale_reviews_on_push !== true) errors.push('main:dismiss-stale');
  if (mainPullRequest.require_code_owner_review !== true) errors.push('main:code-owner');
  if (mainPullRequest.require_last_push_approval !== true) errors.push('main:last-push-approval');
  if (mainPullRequest.required_review_thread_resolution !== true) errors.push('main:thread-resolution');
  if (mainChecks.strict_required_status_checks_policy !== true) errors.push('main:strict-checks');

  const requiredChecks = new Set((mainChecks.required_status_checks ?? []).map((check) => check.context));
  for (const check of ['trust-gate', 'Exact-SHA promotion proof']) {
    if (!requiredChecks.has(check)) errors.push('main:required-check:' + check);
  }

  const executionRules = new Set((executionRuleset?.rules ?? []).map((rule) => rule.type));
  for (const rule of ['deletion', 'non_fast_forward', 'pull_request', 'required_status_checks']) {
    if (!executionRules.has(rule)) errors.push('execution:rule-missing:' + rule);
  }
  if (Number(executionRuleset?.rules?.find((rule) => rule.type === 'pull_request')?.parameters?.required_approving_review_count) < 1) {
    errors.push('execution:review-count');
  }
  if (executionRuleset?.rules?.find((rule) => rule.type === 'required_status_checks')?.parameters?.strict_required_status_checks_policy !== true) {
    errors.push('execution:strict-checks');
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
