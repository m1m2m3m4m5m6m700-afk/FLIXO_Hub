#!/usr/bin/env node
const CANONICAL_REPOSITORY = 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';

async function githubLabel(pathname, token, fetchImpl = fetch) {
  if (!token) throw new Error('FAIL_CLOSED: GH_TOKEN is required.');
  const response = await fetchImpl('https://api.github.com' + pathname, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: 'Bearer ' + token,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'FLIXO-agent-blocked-channel-verifier',
    },
  });
  if (!response.ok) throw new Error('FAIL_CLOSED: GitHub label API ' + response.status + ' for ' + pathname);
  return response.json();
}

export async function verifyAgentBlockedLabels({token, repo = CANONICAL_REPOSITORY, fetchImpl = fetch} = {}) {
  if (repo !== CANONICAL_REPOSITORY) throw new Error('FAIL_CLOSED: non-canonical repository.');
  const labels = [];
  for (const name of ['agent-blocked', 'agent-blocked-global']) {
    const label = await githubLabel(
      '/repos/' + repo + '/labels/' + encodeURIComponent(name),
      token,
      fetchImpl,
    );
    if (label?.name !== name) throw new Error('FAIL_CLOSED: label identity mismatch for ' + name);
    labels.push({name: label.name, color: label.color || null});
  }
  return {repository: repo, labels, status: 'PASS'};
}

if (process.argv[1] && new URL(import.meta.url).href === new URL('file://' + process.argv[1]).href) {
  const result = await verifyAgentBlockedLabels({
    token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPOSITORY || CANONICAL_REPOSITORY,
  });
  console.log(JSON.stringify(result, null, 2));
}
