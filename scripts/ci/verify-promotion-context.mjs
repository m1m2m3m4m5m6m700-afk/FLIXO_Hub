import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CANONICAL_REPOSITORY = 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';
const SHA_PATTERN = /^[a-f0-9]{40}$/u;
const INTEGRATION_HEAD_PATTERN = /^(?:agent-(?:1|2|3|4)|agent3)\/[A-Za-z0-9._-]+-\d{8}$/u;
const ALLOWED_BASE_BRANCHES = new Set(['main', 'execution']);
const QUARANTINED_INTEGRATION_REFS = new Set([
  'agent-2-media-engines-20261006',
]);

export function validatePromotionContext(context) {
  const {
    eventName, repository, headSha, githubSha, headBranch, headRepo, baseBranch, baseRepo,
    prNumber, prHeadSha, prBaseSha, currentBaseSha, mergeBaseSha,
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
  assert.equal(prBaseSha, currentBaseSha, 'PR base moved after verification; candidate is stale');
  assert.equal(mergeBaseSha, prBaseSha, 'merge-base mismatch proves candidate is behind or diverged from current base');

  if (baseBranch === 'main') {
    assert.equal(headBranch, 'execution', 'main promotion must come from execution');
  } else {
    assert.equal(
      QUARANTINED_INTEGRATION_REFS.has(headBranch),
      false,
      'historical/quarantined integration ref cannot be used as promotion lineage',
    );
    assert.equal(
      INTEGRATION_HEAD_PATTERN.test(headBranch),
      true,
      'execution PR source branch is not approved integration lineage',
    );
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
  if (!response.ok) throw new Error('PROMOTION_CONTEXT_API_FAILURE HTTP ' + response.status);
  return response.json();
}

export async function verifyRemotePromotionContext(env = process.env) {
  const eventName = env.GITHUB_EVENT_NAME || '';
  const repository = env.GITHUB_REPOSITORY || '';
  const githubSha = env.GITHUB_SHA || '';
  const token = env.GH_TOKEN || env.GITHUB_TOKEN || '';
  const eventPath = env.GITHUB_EVENT_PATH || '';

  assert.ok(repository, 'GITHUB_REPOSITORY is required');
  assert.ok(githubSha, 'GITHUB_SHA is required');
  assert.ok(eventPath, 'GITHUB_EVENT_PATH is required');
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));

  if (eventName !== 'pull_request') {
    const baseBranch = env.GITHUB_REF_NAME || '';
    validatePromotionContext({
      eventName, repository, headSha: githubSha, githubSha,
      headBranch: baseBranch, headRepo: repository,
      baseBranch, baseRepo: repository,
    });
    console.log('PROMOTION_CONTEXT=PASS mode=push sha=' + githubSha);
    return;
  }

  assert.ok(token, 'GH_TOKEN/GITHUB_TOKEN is required for PR freshness verification');
  const pr = event.pull_request;
  assert.ok(pr && pr.number, 'pull_request event payload is required');

  const headSha = pr.head && pr.head.sha;
  const prBaseSha = pr.base && pr.base.sha;
  const headBranch = pr.head && pr.head.ref;
  const baseBranch = pr.base && pr.base.ref;
  const headRepo = pr.head && pr.head.repo && pr.head.repo.full_name;
  const baseRepo = pr.base && pr.base.repo && pr.base.repo.full_name;

  const apiBase = 'https://api.github.com/repos/' + repository;
  const remotePr = await fetchJson(apiBase + '/pulls/' + pr.number, token);
  const currentBase = await fetchJson(apiBase + '/commits/' + baseBranch, token);
  const compare = await fetchJson(
    apiBase + '/compare/' + remotePr.base.sha + '...' + remotePr.head.sha,
    token,
  );

  validatePromotionContext({
    eventName, repository, headSha, githubSha, headBranch, headRepo, baseBranch, baseRepo,
    prNumber: pr.number,
    prHeadSha: remotePr.head && remotePr.head.sha,
    prBaseSha: remotePr.base && remotePr.base.sha,
    currentBaseSha: currentBase.sha,
    mergeBaseSha: compare.merge_base_commit && compare.merge_base_commit.sha,
  });

  assert.equal(headSha, remotePr.head && remotePr.head.sha, 'event head SHA differs from live PR head SHA');
  assert.equal(prBaseSha, remotePr.base && remotePr.base.sha, 'event base SHA differs from live PR base SHA');
  console.log('PROMOTION_CONTEXT=PASS mode=pull_request sha=' + headSha + ' base=' + prBaseSha);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  verifyRemotePromotionContext().catch((error) => {
    console.error('PROMOTION_CONTEXT=FAIL');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
