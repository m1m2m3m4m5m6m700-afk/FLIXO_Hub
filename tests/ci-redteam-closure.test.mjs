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

test('TestSprite privileged path is trusted-only and fallback has no privileged secret references', () => {
  const workflow = readFileSync('.github/workflows/testsprite-execution.yml', 'utf8');
  const privilegedStart = workflow.indexOf('  testsprite:\n');
  const fallbackStart = workflow.indexOf('  native-exact-sha-fallback:\n');
  assert.ok(privilegedStart >= 0 && fallbackStart > privilegedStart, 'both TestSprite paths must exist');
  const privileged = workflow.slice(privilegedStart, fallbackStart);
  const fallback = workflow.slice(fallbackStart);

  assert.match(privileged, /github\.repository == 'm1m2m3m4m5m6m700-afk\/FLIXO_Hub'/u);
  assert.match(privileged, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(privileged, /secrets\.TESTSPRITE_API_KEY/u);
  assert.match(privileged, /vars\.TESTSPRITE_PROJECT_ID/u);

  assert.match(fallback, /pull_request/u);
  assert.match(fallback, /refs\/heads\/execution/u);
  assert.match(fallback, /github\.event\.pull_request\.head\.sha/u);
  assert.doesNotMatch(fallback, /secrets\./u);
  assert.doesNotMatch(fallback, /vars\./u);
  assert.match(fallback, /persist-credentials: false/u);
});

test('promotion proof rejects forks, stale candidates, merge-base mismatch, and quarantined lineage', () => {
  assert.throws(() => validatePromotionContext({
    eventName: 'pull_request', repository: repo, headSha: sha, githubSha: sha2,
    headBranch: 'execution', headRepo: 'attacker/fork', baseBranch: 'main', baseRepo: repo,
    prNumber: 42, prHeadSha: sha, prBaseSha: sha2, currentBaseSha: sha2, mergeBaseSha: sha2,
  }), /fork PR head repository is not trusted/u);

  assert.throws(() => validatePromotionContext({
    eventName: 'pull_request', repository: repo, headSha: sha, githubSha: sha,
    headBranch: 'agent-2-media-engines-20261006', headRepo: repo,
    baseBranch: 'execution', baseRepo: repo, prNumber: 43,
    prHeadSha: sha, prBaseSha: sha2, currentBaseSha: sha2, mergeBaseSha: sha2,
  }), /historical\/quarantined integration ref cannot be used as promotion lineage/u);

  assert.throws(() => validatePromotionContext({
    eventName: 'pull_request', repository: repo, headSha: sha, githubSha: sha,
    headBranch: 'agent-2/redteam-closure-final-20261006', headRepo: repo,
    baseBranch: 'execution', baseRepo: repo, prNumber: 44,
    prHeadSha: sha2, prBaseSha: sha2, currentBaseSha: sha2, mergeBaseSha: sha2,
  }), /tested SHA must equal the PR head SHA/u);

  assert.throws(() => validatePromotionContext({
    eventName: 'pull_request', repository: repo, headSha: sha, githubSha: sha,
    headBranch: 'agent-2/redteam-closure-final-20261006', headRepo: repo,
    baseBranch: 'execution', baseRepo: repo, prNumber: 45,
    prHeadSha: sha, prBaseSha: sha2, currentBaseSha: sha, mergeBaseSha: sha2,
  }), /PR base moved after verification/u);

  assert.throws(() => validatePromotionContext({
    eventName: 'pull_request', repository: repo, headSha: sha, githubSha: sha,
    headBranch: 'agent-2/redteam-closure-final-20261006', headRepo: repo,
    baseBranch: 'execution', baseRepo: repo, prNumber: 46,
    prHeadSha: sha, prBaseSha: sha2, currentBaseSha: sha2, mergeBaseSha: sha,
  }), /merge-base mismatch/u);

  const accepted = validatePromotionContext({
    eventName: 'pull_request', repository: repo, headSha: sha, githubSha: sha2,
    headBranch: 'agent-2/redteam-closure-final-20261006', headRepo: repo,
    baseBranch: 'execution', baseRepo: repo, prNumber: 47,
    prHeadSha: sha, prBaseSha: sha2, currentBaseSha: sha2, mergeBaseSha: sha2,
  });
  assert.deepEqual(accepted, { mode: 'pull_request', headSha: sha, baseSha: sha2 });
});

test('promotion rejects non-canonical non-PR execution origins', () => {
  assert.throws(() => validatePromotionContext({
    eventName: 'push', repository: 'attacker/repo', headSha: sha, githubSha: sha,
    headBranch: 'execution', headRepo: 'attacker/repo', baseBranch: 'execution',
    baseRepo: 'attacker/repo',
  }), /repository must be canonical/u);
});

test('deployment workflow never rewrites source after the certified artifact is built', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.doesNotMatch(workflow, /Bind exact deployment SHA into Worker runtime/u);
  assert.doesNotMatch(workflow, /path\.write_text/u);
  assert.match(workflow, /Verify deployment worktree purity/u);
  assert.match(workflow, /git diff --name-only/u);
  assert.match(workflow, /--var FLIXO_DEPLOYMENT_SHA:\$\{\{ github\.sha \}\}/u);
});

test('CodeQL SARIF persistence is mandatory', () => {
  const workflow = readFileSync('.github/workflows/codeql.yml', 'utf8');
  assert.match(workflow, /security-events:\s*write/u);
  assert.match(workflow, /upload:\s*always/u);
  assert.doesNotMatch(workflow, /upload:\s*never/u);
});

test('CI keeps fail-closed trust sequencing and reads PR metadata for freshness', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(workflow, /needs: \[trust-gate\]/u);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/u);
  assert.match(workflow, /pull-requests:\s*read/u);
  assert.match(workflow, /verify-promotion-context\.mjs/u);
  assert.match(workflow, /Red Team closure workflow and trust contract tests/u);
});
