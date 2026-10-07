import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const CANONICAL_REPOSITORY = 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';
const SHA = /^[a-f0-9]{40}$/u;

export function validatePromotionProof(input) {
  const errors = [];
  const required = ['eventName','repository','baseRef','headRef','baseRepoFullName','headRepoFullName','baseSha','headSha','candidateSha','liveBaseSha','liveHeadSha','liveMainSha','mergeBaseSha'];
  for (const key of required) if (typeof input[key] !== 'string' || input[key].length === 0) errors.push('missing:' + key);
  const sourceIdentityCount = Number(input.sourceIdentityCount);
  if (!Number.isInteger(sourceIdentityCount) || sourceIdentityCount !== 1) errors.push('source-identity:missing-or-ambiguous');
  if (input.repository !== CANONICAL_REPOSITORY) errors.push('repository:not-canonical');

  if (input.eventName === 'pull_request' && input.baseRef === 'main') {
    if (input.headRef !== 'execution') errors.push('direction:expected-execution-to-main');
    if (input.baseRepoFullName !== CANONICAL_REPOSITORY) errors.push('base-repository:not-canonical');
    if (input.headRepoFullName !== CANONICAL_REPOSITORY) errors.push('head-repository:not-canonical');
    for (const [name, value] of [['baseSha',input.baseSha],['liveBaseSha',input.liveBaseSha],['liveMainSha',input.liveMainSha],['headSha',input.headSha],['liveHeadSha',input.liveHeadSha],['candidateSha',input.candidateSha],['mergeBaseSha',input.mergeBaseSha]]) {
      if (!SHA.test(value)) errors.push(name + ':invalid-sha');
    }
    if (input.headSha !== input.liveHeadSha) errors.push('head:stale-or-changed');
    if (input.headSha !== input.candidateSha) errors.push('candidate:not-exact-head');
    if (input.baseSha !== input.liveBaseSha || input.liveBaseSha !== input.liveMainSha) errors.push('base:stale-or-changed');
    if (input.mergeBaseSha !== input.liveMainSha) errors.push('merge-base:not-fresh-with-live-main');
  } else if (input.eventName === 'pull_request' && input.baseRef === 'execution') {
    if (input.baseRepoFullName !== CANONICAL_REPOSITORY) errors.push('base-repository:not-canonical');
    if (input.headRepoFullName !== CANONICAL_REPOSITORY) errors.push('head-repository:not-canonical');
    if (!SHA.test(input.headSha) || !SHA.test(input.candidateSha)) errors.push('candidate:invalid-sha');
    if (input.headSha !== input.candidateSha) errors.push('candidate:not-exact-head');
  } else if (!(input.eventName === 'push' && (input.baseRef === 'main' || input.baseRef === 'execution'))) {
    errors.push('event:not-supported-for-promotion-proof');
  }
  return { ok: errors.length === 0, errors };
}

async function githubJson(pathname) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const base = process.env.GITHUB_API_URL || 'https://api.github.com';
  if (!token) throw new Error('FAIL_CLOSED: GH_TOKEN or GITHUB_TOKEN is required.');
  const response = await fetch(base + pathname, {
    headers: { accept: 'application/vnd.github+json', authorization: 'Bearer ' + token, 'x-github-api-version': '2022-11-28', 'user-agent': 'FLIXO-promotion-lineage-verifier' },
  });
  if (!response.ok) throw new Error('FAIL_CLOSED: GitHub API ' + response.status + ' for ' + pathname);
  return response.json();
}

async function verifyLiveLineage() {
  const repository = process.env.GITHUB_REPOSITORY || '';
  const eventName = process.env.GITHUB_EVENT_NAME || '';
  const candidateSha = process.env.EXPECTED_SHA || process.env.GITHUB_SHA || '';
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (repository !== CANONICAL_REPOSITORY) throw new Error('FAIL_CLOSED: non-canonical repository.');
  if (!SHA.test(candidateSha)) throw new Error('FAIL_CLOSED: invalid candidate SHA.');
  if (!eventPath) throw new Error('FAIL_CLOSED: GITHUB_EVENT_PATH is required.');
  const event = JSON.parse(await readFile(eventPath, 'utf8'));
  if (eventName !== 'pull_request') {
    if (eventName === 'push' && (process.env.GITHUB_REF === 'refs/heads/main' || process.env.GITHUB_REF === 'refs/heads/execution')) {
      if (candidateSha !== event.after) throw new Error('FAIL_CLOSED: push candidate SHA mismatch.');
      console.log('PROMOTION_LINEAGE=PASS_PUSH_EXACT_SHA');
      return;
    }
    throw new Error('FAIL_CLOSED: unsupported event for promotion proof.');
  }

  const prNumber = event.pull_request?.number;
  if (!Number.isInteger(prNumber)) throw new Error('FAIL_CLOSED: PR number missing.');
  const livePr = await githubJson('/repos/' + repository + '/pulls/' + prNumber);
  const liveMain = await githubJson('/repos/' + repository + '/git/ref/heads/main');
  const headRepo = livePr.head?.repo?.full_name || '';
  const baseRepo = livePr.base?.repo?.full_name || '';
  const sourceIdentityCount = headRepo ? 1 : 0;
  const baseRef = livePr.base?.ref || '';
  const headRef = livePr.head?.ref || '';
  const baseSha = event.pull_request?.base?.sha || '';
  const liveBaseSha = livePr.base?.sha || '';
  const liveMainSha = liveMain.object?.sha || '';
  const liveHeadSha = livePr.head?.sha || '';

  if (baseRef === 'main') {
    execFileSync('git', ['fetch','--no-tags','--prune','origin','main'], { stdio: 'inherit' });
  }
  const mergeBaseSha = baseRef === 'main' ? execFileSync('git',['merge-base',candidateSha,'refs/remotes/origin/main'],{encoding:'utf8'}).trim() : candidateSha;
  const proof = { eventName, repository, baseRef, headRef, baseRepoFullName:baseRepo, headRepoFullName:headRepo, baseSha, headSha:candidateSha, candidateSha, liveBaseSha, liveHeadSha, liveMainSha, mergeBaseSha, sourceIdentityCount };
  const result = validatePromotionProof(proof);
  if (!result.ok) {
    console.error('PROMOTION_LINEAGE=FAIL');
    for (const error of result.errors) console.error(error);
    process.exit(1);
  }
  console.log('PROMOTION_LINEAGE=PASS');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await verifyLiveLineage();