import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateGovernanceMetrics, collectGovernanceMetrics } from './agent-governance-metrics.mjs';

test('downgrade thresholds stay inactive below the 10-PR floor', () => {
  const result = evaluateGovernanceMetrics({
    sampleSize: 9,
    buildSuccessRate: 0,
    regressions: 99,
    rollbacks: 1,
    rejectedReviewRate: 1,
  });
  assert.equal(result.ok, true);
  assert.equal(result.enforcement, false);
  assert.equal(result.downgraded, false);
});

test('downgrade triggers only on explicit threshold breaches', () => {
  const result = evaluateGovernanceMetrics({
    sampleSize: 10,
    buildSuccessRate: 0.89,
    regressions: 0,
    rollbacks: 0,
    rejectedReviewRate: 0,
  });
  assert.equal(result.ok, true);
  assert.equal(result.enforcement, true);
  assert.equal(result.downgraded, true);
  assert.deepEqual(result.reasons, ['build-success-rate<90%']);
});

test('multiple threshold breaches are cumulative and deterministic', () => {
  const result = evaluateGovernanceMetrics({
    sampleSize: 20,
    buildSuccessRate: 0.95,
    regressions: 3,
    rollbacks: 0.15,
    rejectedReviewRate: 0.31,
  });
  assert.equal(result.downgraded, true);
  assert.deepEqual(result.reasons, [
    'regressions>2',
    'rollback-rate>10%',
    'rejected-review-rate>30%',
  ]);
});

test('live collector uses only merged PRs inside the 30-day / 20-PR window', async () => {
  const calls = [];
  const pullRequests = [
    {
      number: 1, merged_at: '2026-10-07T00:00:00Z',
      head: { sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      merge_commit_sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      labels: [{ name: 'regression' }],
    },
    {
      number: 2, merged_at: '2026-09-01T00:00:00Z',
      head: { sha: 'cccccccccccccccccccccccccccccccccccccc' },
      merge_commit_sha: 'dddddddddddddddddddddddddddddddddddddd',
      labels: [],
    },
    { number: 3, merged_at: null, head: { sha: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' }, labels: [] },
  ];

  const responses = new Map([
    ['/repos/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pulls?state=closed&sort=updated&direction=desc&per_page=100', pullRequests],
    ['/repos/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pulls/1/reviews?per_page=100', [{ state: 'CHANGES_REQUESTED' }]],
    ['/repos/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs?head_sha=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&per_page=100', { workflow_runs: [{ name: 'FLIXO CI', status: 'completed', conclusion: 'success', updated_at: '2026-10-07T01:00:00Z' }] }],
    ['/repos/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pulls/2/reviews?per_page=100', []],
    ['/repos/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs?head_sha=cccccccccccccccccccccccccccccccccccccc&per_page=100', { workflow_runs: [{ name: 'FLIXO CI', status: 'completed', conclusion: 'failure', updated_at: '2026-09-01T01:00:00Z' }] }],
    ['/repos/m1m2m3m4m5m6m700-afk/FLIXO_Hub/commits?since=2026-09-08T00:00:00.000Z&per_page=100', []],
  ]);

  const fetchImpl = async url => {
    const path = new URL(url).pathname + (new URL(url).search || '');
    calls.push(path);
    if (!responses.has(path)) throw new Error('unexpected:' + path);
    return { ok: true, json: async () => responses.get(path) };
  };

  const result = await collectGovernanceMetrics({
    token: 'test-token',
    repo: 'm1m2m3m4m5m6m700-afk/FLIXO_Hub',
    now: new Date('2026-10-08T00:00:00Z'),
    fetchImpl,
  });

  assert.equal(result.metrics.completedPRs.length, 1);
  assert.equal(result.metrics.regressions, 1);
  assert.equal(result.metrics.rejectedReviewRate, 1);
  assert.equal(result.metrics.buildSuccessRate, 1);
  assert.equal(result.decision.enforcement, false);
  assert.ok(calls.some(path => path.includes('/pulls?state=closed')));
});
