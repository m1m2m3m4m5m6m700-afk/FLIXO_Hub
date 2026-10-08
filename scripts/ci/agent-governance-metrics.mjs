#!/usr/bin/env node
const CANONICAL_REPOSITORY = 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';
const SAMPLE_MAX = 20;
const WINDOW_DAYS = 30;

async function githubJson(pathname, token, fetchImpl = fetch) {
  if (!token) throw new Error('FAIL_CLOSED: GH_TOKEN is required.');
  const response = await fetchImpl('https://api.github.com' + pathname, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: 'Bearer ' + token,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'FLIXO-agent-governance-metrics',
    },
  });
  if (!response.ok) throw new Error('FAIL_CLOSED: GitHub API ' + response.status + ' for ' + pathname);
  return response.json();
}

function isoDaysAgo(days, now = new Date()) {
  return new Date(now.getTime() - days * 86400000).toISOString();
}

export function evaluateGovernanceMetrics(input) {
  const sampleSize = Number(input.sampleSize ?? 0);
  const buildSuccessRate = Number(input.buildSuccessRate ?? NaN);
  const regressions = Number(input.regressions ?? 0);
  const rollbacks = Number(input.rollbacks ?? 0);
  const rejectedReviewRate = Number(input.rejectedReviewRate ?? NaN);
  const failures = [];
  if (!Number.isInteger(sampleSize) || sampleSize < 0) failures.push('sample-size:invalid');
  if (!Number.isFinite(buildSuccessRate) || buildSuccessRate < 0 || buildSuccessRate > 1) failures.push('build-success-rate:invalid');
  if (!Number.isInteger(regressions) || regressions < 0) failures.push('regressions:invalid');
  if (!Number.isFinite(rollbacks) || rollbacks < 0 || rollbacks > 1) failures.push('rollback-rate:invalid');
  if (!Number.isFinite(rejectedReviewRate) || rejectedReviewRate < 0 || rejectedReviewRate > 1) failures.push('rejected-review-rate:invalid');

  const reasons = [];
  const sampleEligible = sampleSize >= 10;
  if (sampleEligible) {
    if (buildSuccessRate < 0.90) reasons.push('build-success-rate<90%');
    if (regressions > 2) reasons.push('regressions>2');
    if (rollbacks > 0.10) reasons.push('rollback-rate>10%');
    if (rejectedReviewRate > 0.30) reasons.push('rejected-review-rate>30%');
  }

  return {
    ok: failures.length === 0,
    enforcement: sampleEligible,
    downgraded: sampleEligible && reasons.length > 0,
    reasons: failures.length ? failures : reasons,
    thresholds: {
      minimumCompletedPRs: 10,
      buildSuccessRateMin: 0.90,
      regressionsMaxInclusive: 2,
      rollbackRateMaxInclusive: 0.10,
      rejectedReviewRateMaxInclusive: 0.30,
    },
  };
}

export async function collectGovernanceMetrics({
  token,
  repo = CANONICAL_REPOSITORY,
  now = new Date(),
  fetchImpl = fetch,
} = {}) {
  if (repo !== CANONICAL_REPOSITORY) throw new Error('FAIL_CLOSED: non-canonical repository.');
  const since = isoDaysAgo(WINDOW_DAYS, now);
  const pulls = await githubJson(
    '/repos/' + repo + '/pulls?state=closed&sort=updated&direction=desc&per_page=100',
    token,
    fetchImpl,
  );

  const merged = (pulls ?? [])
    .filter(pr => pr?.merged_at && pr.merged_at >= since)
    .sort((a, b) => new Date(b.merged_at) - new Date(a.merged_at))
    .slice(0, SAMPLE_MAX);

  let buildSuccesses = 0;
  let regressions = 0;
  let rejectedReviewPRs = 0;

  for (const pr of merged) {
    const reviews = await githubJson(
      '/repos/' + repo + '/pulls/' + pr.number + '/reviews?per_page=100',
      token,
      fetchImpl,
    );
    if ((reviews ?? []).some(review => String(review?.state).toUpperCase() === 'CHANGES_REQUESTED')) rejectedReviewPRs++;

    if ((pr.labels ?? []).some(label => String(label?.name).toLowerCase() === 'regression')) regressions++;

    const sha = pr.head?.sha || '';
    if (!sha) continue;
    const runs = await githubJson(
      '/repos/' + repo + '/actions/runs?head_sha=' + encodeURIComponent(sha) + '&per_page=100',
      token,
      fetchImpl,
    );
    const ciRuns = (runs?.workflow_runs ?? [])
      .filter(run => run?.name === 'FLIXO CI' && run?.status === 'completed')
      .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
    if (ciRuns[0]?.conclusion === 'success') buildSuccesses++;
  }

  let rollbacks = 0;
  if (merged.length) {
    const commits = await githubJson(
      '/repos/' + repo + '/commits?since=' + encodeURIComponent(since) + '&per_page=100',
      token,
      fetchImpl,
    );
    for (const pr of merged) {
      const identifiers = [pr.head?.sha, pr.merge_commit_sha].filter(Boolean);
      if ((commits ?? []).some(commit => {
        const message = String(commit?.commit?.message || '');
        return /^Revert\b/imu.test(message) && identifiers.some(id => message.includes(id));
      })) rollbacks++;
    }
  }

  const sampleSize = merged.length;
  const metrics = {
    repository: repo,
    window: {
      type: 'last-30-days-capped-at-20-merged-PRs',
      since,
      sampleSize,
      minimumForEnforcement: 10,
    },
    buildSuccessRate: sampleSize ? buildSuccesses / sampleSize : 1,
    regressions,
    rollbackRate: sampleSize ? rollbacks / sampleSize : 0,
    rejectedReviewRate: sampleSize ? rejectedReviewPRs / sampleSize : 0,
    completedPRs: merged.map(pr => ({
      number: pr.number,
      mergedAt: pr.merged_at,
      headSha: pr.head?.sha || null,
      labels: (pr.labels ?? []).map(label => label?.name).filter(Boolean),
    })),
  };
  return { metrics, decision: evaluateGovernanceMetrics({
    sampleSize,
    buildSuccessRate: metrics.buildSuccessRate,
    regressions,
    rollbacks: metrics.rollbackRate,
    rejectedReviewRate: metrics.rejectedReviewRate,
  }) };
}

if (process.argv[1] && new URL(import.meta.url).pathname === new URL('file://' + process.argv[1]).pathname) {
  const result = await collectGovernanceMetrics({
    token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPOSITORY || CANONICAL_REPOSITORY,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.decision.ok) process.exit(1);
}
