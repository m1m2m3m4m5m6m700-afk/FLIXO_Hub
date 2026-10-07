#!/usr/bin/env node
import { strict as assert } from 'node:assert';

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY || '';
const prNumber = process.env.PR_NUMBER || '';
const expectedSha = process.env.EXPECTED_SHA || '';
const prAuthor = process.env.PR_AUTHOR || '';

assert.ok(token, 'GH_TOKEN or GITHUB_TOKEN is required');
assert.match(repo, /^[^/]+\/[^/]+$/u, 'canonical repository is required');
assert.match(prNumber, /^\d+$/u, 'PR_NUMBER is required');
assert.match(expectedSha, /^[0-9a-f]{40}$/u, 'EXPECTED_SHA must be an exact commit SHA');
assert.ok(prAuthor, 'PR_AUTHOR is required');

const reviews = [];
let nextUrl = `https://api.github.com/repos/${repo}/pulls/${prNumber}/reviews?per_page=100&page=1`;

for (let page = 0; page < 100 && nextUrl; page += 1) {
  const response = await fetch(nextUrl, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'FLIXO-current-head-approval-verifier',
    },
  });
  if (!response.ok) throw new Error(`APPROVAL_CHECK_HTTP_${response.status}`);
  const pageReviews = await response.json();
  if (!Array.isArray(pageReviews)) throw new Error('APPROVAL_CHECK_INVALID_RESPONSE');
  reviews.push(...pageReviews);
  const link = response.headers.get('link') ?? '';
  const match = link.match(/<([^>]+)>;\\s*rel="next"/u);
  nextUrl = match?.[1] ?? null;
}

if (nextUrl) throw new Error('APPROVAL_CHECK_REVIEW_PAGINATION_LIMIT');

const latestByReviewer = new Map();
for (const review of reviews) {
  const login = review?.user?.login;
  if (!login) continue;
  const current = latestByReviewer.get(login);
  const submittedAt = Date.parse(review.submitted_at ?? '') || 0;
  const currentAt = current ? Date.parse(current.submitted_at ?? '') || 0 : -1;
  if (!current || submittedAt >= currentAt) latestByReviewer.set(login, review);
}

const approved = [...latestByReviewer.values()].some((review) =>
  review.state === 'APPROVED' &&
  review.commit_id === expectedSha &&
  review.user.login !== prAuthor &&
  review.user.type !== 'Bot',
);

if (!approved) {
  console.error(`FAIL_CLOSED: no independent approval for current head ${expectedSha}`);
  process.exit(1);
}

console.log(`CURRENT_HEAD_INDEPENDENT_APPROVAL=PASS:${expectedSha}`);
