#!/usr/bin/env node
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const API_VERSION = '2022-11-28';
const DEFAULT_BRANCH = 'main';

function branchRef(branch) {
  return `refs/heads/${branch}`;
}

export function evaluateMainGovernance(rulesets, branch = DEFAULT_BRANCH, mode = 'strict') {
  const target = branchRef(branch);
  const applicable = (rulesets ?? []).filter(
    (ruleset) =>
      ruleset?.enforcement === 'active' &&
      ruleset?.target === 'branch' &&
      ruleset?.conditions?.ref_name?.include?.includes(target),
  );

  if (applicable.length === 0) {
    return {
      pass: false,
      applicableRulesetIds: [],
      failures: [`No active ruleset targets ${target}.`],
    };
  }

  const pullRequestRules = applicable
    .flatMap((ruleset) => ruleset.rules ?? [])
    .filter((rule) => rule?.type === 'pull_request')
    .map((rule) => rule.parameters ?? {});

  const statusRules = applicable
    .flatMap((ruleset) => ruleset.rules ?? [])
    .filter((rule) => rule?.type === 'required_status_checks')
    .map((rule) => rule.parameters ?? {});

  const requiredContexts = new Set(
    statusRules.flatMap((params) =>
      (params.required_status_checks ?? [])
        .map((check) => check?.context)
        .filter(Boolean),
    ),
  );

  const failures = [];
  assert.ok(pullRequestRules.length > 0, 'main governance requires a pull-request rule');
  assert.ok(statusRules.length > 0, 'main governance requires required status checks');

  if (mode === 'fast') {
    for (const context of ['trust-gate', 'Exact-SHA promotion proof']) {
      if (!requiredContexts.has(context)) failures.push('Required status check missing: ' + context);
    }
    return { pass: failures.length === 0, applicableRulesetIds: applicable.map((ruleset) => ruleset.id), failures, mode };
  }

  const requiredApprovals = Math.max(
    0,
    ...pullRequestRules.map((params) => Number(params.required_approving_review_count ?? 0)),
  );
  if (requiredApprovals < 1) failures.push('At least one approving review is required.');

  if (!pullRequestRules.some((params) => params.dismiss_stale_reviews_on_push === true)) {
    failures.push('Stale approvals must be dismissed on push.');
  }

  if (!pullRequestRules.some((params) => params.require_code_owner_review === true)) {
    failures.push('Code Owner review must be required.');
  }

  if (!pullRequestRules.some((params) => params.require_last_push_approval === true)) {
    failures.push('Latest-push approval must require an independent approver.');
  }

  if (!pullRequestRules.some((params) => params.required_review_thread_resolution === true)) {
    failures.push('Review threads must be resolved before merge.');
  }

  if (!statusRules.every((params) => params.strict_required_status_checks_policy === true)) {
    failures.push('All applicable required status-check rules must be strict.');
  }

  for (const context of ['trust-gate', 'Exact-SHA promotion proof']) {
    if (!requiredContexts.has(context)) {
      failures.push(`Required status check missing: ${context}`);
    }
  }

  return {
    pass: failures.length === 0,
    applicableRulesetIds: applicable.map((ruleset) => ruleset.id),
    failures,
  };
}

async function githubJson(url, token) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': API_VERSION,
      'user-agent': 'FLIXO-governance-verifier',
    },
  });
  if (!response.ok) {
    throw new Error(`GOVERNANCE_API_FAILURE: HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

export async function verifyLiveMainGovernance({
  token,
  repo,
  branch = DEFAULT_BRANCH,
  mode = 'strict',
  fetchJson = githubJson,
}) {
  if (!token || !repo) {
    throw new Error('GOVERNANCE_EVIDENCE_UNAVAILABLE: GH_TOKEN and GITHUB_REPOSITORY are required.');
  }

  const apiRoot = `https://api.github.com/repos/${repo}`;
  const summaries = await fetchJson(`${apiRoot}/rulesets?per_page=100`, token);
  const details = [];

  for (const summary of summaries ?? []) {
    if (summary?.target !== 'branch' || summary?.enforcement !== 'active') continue;

    const targetRef = summary?._links?.self?.href || `${apiRoot}/rulesets/${summary.id}`;
    const detail = await fetchJson(targetRef, token);
    if (
      detail?.enforcement === 'active' &&
      detail?.target === 'branch' &&
      detail?.conditions?.ref_name?.include?.includes(branchRef(branch))
    ) {
      details.push(detail);
    }
  }

  const evaluated = evaluateMainGovernance(details, branch, mode);
  if (!evaluated.pass) {
    throw new Error(
      [
        `MAIN_GOVERNANCE=FAIL mode=${mode} branch=${branch}`,
        `APPLICABLE_RULESET_IDS=${evaluated.applicableRulesetIds.join(',') || 'NONE'}`,
        ...evaluated.failures,
      ].join('\n'),
    );
  }

  console.log(`MAIN_GOVERNANCE=PASS mode=${mode} branch=${branch}`);
  console.log(`APPLICABLE_RULESET_IDS=${evaluated.applicableRulesetIds.join(',')}`);
  return evaluated;
}

const executedDirectly =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (executedDirectly) {
  await verifyLiveMainGovernance({
    token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPOSITORY,
    branch: process.env.GOVERNANCE_BRANCH || DEFAULT_BRANCH,
    mode: process.env.GOVERNANCE_MODE || 'strict',
  });
}
