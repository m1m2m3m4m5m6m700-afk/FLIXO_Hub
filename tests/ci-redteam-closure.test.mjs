import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { validatePromotionContext } from '../scripts/ci/verify-promotion-context.mjs';

const repo = 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';
const sha = 'a'.repeat(40);
const sha2 = 'b'.repeat(40);

test('every third-party GitHub Action is immutably pinned', () => {
  for (const file of readdirSync('.github/workflows').filter((name) => /\.ya?ml$/u.test(name))) {
    const content = readFileSync('.github/workflows/' + file, 'utf8');
    for (const [index, line] of content.split(/\r?\n/u).entries()) {
      const match = line.match(/^\s*uses:\s*([^\s#]+)/u);
      if (!match || match[1].startsWith('./')) continue;
      assert.match(match[1], /@[0-9a-f]{40}$/u, file + ':' + (index + 1) + ' must use a commit SHA');
    }
  }
});

test('TestSprite secret-consuming job is restricted to canonical main and fallback has no secrets', () => {
  const workflow = readFileSync('.github/workflows/testsprite-execution.yml', 'utf8');
  assert.match(workflow, /github\.repository == 'm1m2m3m4m5m6m700-afk\/FLIXO_Hub'/u);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  const fallbackMarker = '  native-exact-sha-fallback:\n';
  const fallbackStart = workflow.indexOf(fallbackMarker);
  assert.ok(fallbackStart >= 0, 'unprivileged fallback job must exist');
  const fallback = workflow.slice(fallbackStart);
  assert.doesNotMatch(fallback, /secrets\./u);
  assert.doesNotMatch(fallback, /vars\./u);
  assert.match(fallback, /pull_request/u);
  assert.match(fallback, /refs\/heads\/execution/u);
  assert.match(fallback, /github\.event\.pull_request\.head\.sha/u);
});

test('promotion proof rejects fork origins even when branch is named execution', () => {
  assert.throws(() => validatePromotionContext({
    eventName: 'pull_request', repository: repo, headSha: sha, githubSha: sha2,
    headBranch: 'execution', headRepo: 'attacker/fork', baseBranch: 'main', baseRepo: repo,
    prNumber: '42', prHeadSha: sha, prBaseSha: sha2, currentBaseSha: sha2, mergeBaseSha: sha2,
  }), /fork PR head repository is not trusted/u);
});

test('promotion proof rejects a fork PR targeting execution', () => {
  assert.throws(() => validatePromotionContext({
    eventName: 'pull_request', repository: repo, headSha: sha, githubSha: sha2,
    headBranch: 'agent-2/redteam-closure-20261006', headRepo: 'attacker/fork', baseBranch: 'execution', baseRepo: repo,
    prNumber: '43', prHeadSha: sha, prBaseSha: sha2, currentBaseSha: sha2, mergeBaseSha: sha2,
  }), /fork PR head repository is not trusted/u);
});

test('promotion proof rejects stale head SHA and changed base SHA', () => {
  assert.throws(() => validatePromotionContext({
    eventName: 'pull_request', repository: repo, headSha: sha, githubSha: sha,
    headBranch: 'agent-2/redteam-closure-20261006', headRepo: repo, baseBranch: 'execution', baseRepo: repo,
    prNumber: '44', prHeadSha: sha2, prBaseSha: sha2, currentBaseSha: sha2, mergeBaseSha: sha2,
  }), /tested SHA must equal the PR head SHA/u);
  assert.throws(() => validatePromotionContext({
    eventName: 'pull_request', repository: repo, headSha: sha, githubSha: sha,
    headBranch: 'agent-2/redteam-closure-20261006', headRepo: repo, baseBranch: 'execution', baseRepo: repo,
    prNumber: '45', prHeadSha: sha, prBaseSha: sha2, currentBaseSha: sha, mergeBaseSha: sha2,
  }), /PR base moved after verification/u);
});

test('promotion proof rejects merge-base mismatch and accepts current canonical lineage', () => {
  assert.throws(() => validatePromotionContext({
    eventName: 'pull_request', repository: repo, headSha: sha, githubSha: sha,
    headBranch: 'agent-2/redteam-closure-20261006', headRepo: repo, baseBranch: 'execution', baseRepo: repo,
    prNumber: '46', prHeadSha: sha, prBaseSha: sha2, currentBaseSha: sha2, mergeBaseSha: sha,
  }), /merge-base mismatch/u);
  const result = validatePromotionContext({
    eventName: 'pull_request', repository: repo, headSha: sha, githubSha: sha2,
    headBranch: 'agent-2/redteam-closure-20261006', headRepo: repo, baseBranch: 'execution', baseRepo: repo,
    prNumber: '47', prHeadSha: sha, prBaseSha: sha2, currentBaseSha: sha2, mergeBaseSha: sha2,
  });
  assert.equal(result.mode, 'pull_request');
  assert.equal(result.headSha, sha);
});

test('execution branch governance is dated and legacy refs are quarantined', () => {
  const policy = readFileSync('scripts/ci/verify-branch-policy.mjs', 'utf8');
  assert.match(policy, /coordinationPatterns/u);
  assert.match(policy, /\\d\{8\}/u);
  assert.match(policy, /agent-2-media-engines-20261006/u);
  assert.match(policy, /must not be accepted as promotion lineage/u);
});

test('deployment workflow never rewrites source after the certified artifact is built', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.doesNotMatch(workflow, /Bind exact deployment SHA into Worker runtime/u);
  assert.doesNotMatch(workflow, /Path\(['"]src\/worker\.ts['"]\)/u);
  assert.doesNotMatch(workflow, /path\.write_text/u);
  assert.match(workflow, /Verify deployment worktree purity/u);
  assert.match(workflow, /git diff --name-only/u);
});

test('CodeQL SARIF persistence is enabled and upload never is forbidden', () => {
  const workflow = readFileSync('.github/workflows/codeql.yml', 'utf8');
  assert.match(workflow, /security-events:\s*write/u);
  assert.match(workflow, /upload:\s*always/u);
  assert.doesNotMatch(workflow, /upload:\s*never/u);
});

test('CI retains fail-closed exact-SHA promotion sequencing', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(workflow, /needs: \[trust-gate\]/u);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/u);
  assert.match(workflow, /verify-promotion-context\.mjs/u);
});
