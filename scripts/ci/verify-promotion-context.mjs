import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const CANONICAL_REPOSITORY = 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';
const SHA_PATTERN = /^[a-f0-9]{40}$/u;
const INTEGRATION_HEAD_PATTERN = /^(?:agent-(?:1|2|3|4)|agent3)\/[A-Za-z0-9._-]+-\d{8}$/u;
const ALLOWED_BASE_BRANCHES = new Set(['main', 'execution']);

export function validatePromotionContext(context) {
  const {
    eventName, repository, headSha, githubSha, headBranch, headRepo, baseBranch, baseRepo,
    prNumber, prHeadSha, prBaseSha, baseSha, currentBaseSha, mergeBaseSha,
  } = context;

  assert.equal(repository, CANONICAL_REPOSITORY, 'repository must be canonical');
  assert.match(headSha, SHA_PATTERN, 'head SHA must be a full immutable commit SHA');

  if (eventName !== 'pull_request') {
    assert.equal(headSha, githubSha, 'non-PR candidate SHA must equal github.sha');
    assert.ok(ALLOWED_BASE_BRANCHES.has(baseBranch), 'non-PR event must target an approved operational branch');
    assert.equal(headRepo, repository, 'non-PR execution must originate in the canonical repository');
    assert.equal(baseRepo, repository, 'non-PR execution must belong to the canonical repository');
    return { mode: 'push', headSha };
  }

  assert.ok(prNumber, 'promotion-sensitive PRs require a PR number');
  assert.ok(ALLOWED_BASE_BRANCHES.has(baseBranch), 'PR base must be main or execution');
  assert.equal(headRepo, repository, 'fork PR head repository is not trusted');
  assert.equal(baseRepo, repository, 'fork PR base repository is not trusted');
  assert.equal(headSha, prHeadSha, 'tested SHA must equal the PR head SHA');
  assert.match(prBaseSha, SHA_PATTERN, 'PR base SHA must be a full immutable commit SHA');
  assert.match(baseSha, SHA_PATTERN, 'event base SHA must be a full immutable commit SHA');
  assert.equal(prBaseSha, baseSha, 'PR base SHA mismatch');
  assert.equal(prBaseSha, currentBaseSha, 'PR base moved after verification; candidate is stale');
  assert.equal(mergeBaseSha, prBaseSha, 'merge-base mismatch proves candidate is behind or diverged from current base');

  if (baseBranch === 'main') {
    assert.equal(headBranch, 'execution', 'main promotion must come from execution');
  } else {
    assert.equal(INTEGRATION_HEAD_PATTERN.test(headBranch), true, 'execution PR source branch is not approved integration lineage');
  }

  return { mode: 'pull_request', headSha, baseSha: prBaseSha };
}

async function fetchJson(url, token) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: 'Bearer ' + token,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'FLIXO-red-team-promotion-verifier',
    },
  });
  if (!response.ok) throw new Error('PROMOTION_CONTEXT_API_FAILURE HTTP ' + response.status + ' ' + url);
  return response.json();
}

export async function verifyRemotePromotionContext(env = process.env) {
  const eventName = env.GITHUB_EVENT_NAME || '';
  const repository = env.GITHUB_REPOSITORY || '';
  const headSha = env.HEAD_SHA || '';
  const githubSha = env.GITHUB_SHA || '';
  const headBranch = env.HEAD_BRANCH || '';
  const headRepo = env.HEAD_REPO || repository;
  const baseBranch = env.BASE_BRANCH || '';
  const baseRepo = env.BASE_REPO || repository;
  const token = env.GH_TOKEN || env.GITHUB_TOKEN || '';

  if (eventName !== 'pull_request') {
    validatePromotionContext({ eventName, repository, headSha, githubSha, headBranch, headRepo, baseBranch, baseRepo });
    console.log('PROMOTION_CONTEXT=PASS mode=push sha=' + headSha);
    return;
  }

  assert.ok(token, 'GH_TOKEN/GITHUB_TOKEN is required for PR freshness verification');
  const prNumber = env.PR_NUMBER || '';
  assert.ok(prNumber, 'PR number is required for promotion-sensitive verification');
  const apiBase = 'https://api.github.com/repos/' + repository;
  const pr = await fetchJson(apiBase + '/pulls/' + prNumber, token);
  const currentBase = await fetchJson(apiBase + '/commits/' + baseBranch, token);
  const compare = await fetchJson(apiBase + '/compare/' + pr.base.sha + '...' + pr.head.sha, token);

  validatePromotionContext({
    eventName, repository, headSha, githubSha, headBranch, headRepo, baseBranch, baseRepo,
    prNumber, prHeadSha: pr.head && pr.head.sha, prBaseSha: pr.base && pr.base.sha,
    baseSha: env.PR_BASE_SHA, currentBaseSha: currentBase.sha, mergeBaseSha: compare.merge_base_commit && compare.merge_base_commit.sha,
  });

  console.log('PROMOTION_CONTEXT=PASS mode=pull_request sha=' + headSha + ' base=' + pr.base.sha + ' merge_base=' + (compare.merge_base_commit && compare.merge_base_commit.sha));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  verifyRemotePromotionContext().catch((error) => {
    console.error('PROMOTION_CONTEXT=FAIL');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
