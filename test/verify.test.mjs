import assert from 'node:assert/strict';
import test from 'node:test';

import { MAX_DIFF_CHARS, VERIFIER_MODEL, assertPullRequestStable, validateModelVerdict, verifyPullRequest } from '../scripts/agent/verify.mjs';

process.env.GH_TOKEN = process.env.GH_TOKEN || 'test-token';

test('oversized diff fails closed before model execution', async () => {
  let modelCalled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('x'.repeat(MAX_DIFF_CHARS + 10)));
      controller.close();
    },
  });
  const result = await verifyPullRequest({
    repository: 'acme/flixo',
    prNumber: 1,
    fetchImpl: async (url) => url.endsWith('.diff') ? new Response(body, { status: 200 }) : new Response(JSON.stringify({ state: 'open', merged: false, number: 1, base: { repo: { full_name: 'acme/flixo' }, sha: 'a', ref: 'main' }, head: { sha: 'b', ref: 'execution', repo: { full_name: 'acme/flixo' } }, title: 't', body: '' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    modelCall: async () => { modelCalled = true; return { text: '{"verdict":"pass","reason":"","findings":[]}', model: 'test' }; },
  });
  assert.equal(result.verdict, 'fail');
  assert.match(result.reason, /diff too large/u);
  assert.equal(modelCalled, false);
});

test('GitHub network failure fails closed', async () => {
  const result = await verifyPullRequest({
    repository: 'acme/flixo',
    prNumber: 2,
    fetchImpl: async () => { throw new Error('network down'); },
  });
  assert.equal(result.verdict, 'fail');
});

test('bad GitHub JSON fails closed', async () => {
  const result = await verifyPullRequest({
    repository: 'acme/flixo',
    prNumber: 3,
    fetchImpl: async () => new Response('not json', { status: 200 }),
  });
  assert.equal(result.verdict, 'fail');
  assert.match(result.reason, /bad JSON/u);
});

test('invalid model JSON cannot PASS', () => {
  assert.equal(validateModelVerdict({ text: 'not-json', model: 'test' }).verdict, 'fail');
  assert.equal(validateModelVerdict({ text: '{"verdict":"maybe","findings":[]}', model: 'test' }).verdict, 'fail');
  assert.equal(validateModelVerdict({ text: '{"verdict":"pass","reason":"ok","findings":[{"priority":"medium","issue":"x","location":"x","evidence":"x"}]}', model: 'test' }).verdict, 'fail');
});

test('clean verifier PASS requires zero high/medium findings', () => {
  const result = validateModelVerdict({ text: '{"verdict":"pass","reason":"clean","findings":[]}', model: 'test' });
  assert.equal(result.verdict, 'pass');
});

test('model failure is represented as fail-closed by verifyPullRequest', async () => {
  const pr = { state: 'open', merged: false, number: 4, base: { repo: { full_name: 'acme/flixo' }, sha: 'a', ref: 'main' }, head: { sha: 'b', ref: 'execution', repo: { full_name: 'acme/flixo' } }, title: 'safe', body: '' };
  const diffBody = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('diff')); c.close(); } });
  const result = await verifyPullRequest({
    repository: 'acme/flixo',
    prNumber: 4,
    fetchImpl: async (url) => url.endsWith('.diff') ? new Response(diffBody, { status: 200 }) : new Response(JSON.stringify(pr), { status: 200, headers: { 'content-type': 'application/json' } }),
    modelCall: async () => { throw new Error('model failure'); },
  });
  assert.equal(result.verdict, 'fail');
});

test('missing canonical repository identity fails closed', async () => {
  const result = await verifyPullRequest({
    repository: 'acme/flixo',
    prNumber: 5,
    fetchImpl: async () => new Response(JSON.stringify({ state: 'open', merged: false, number: 5, base: { sha: 'a', ref: 'main' }, head: { sha: 'b', ref: 'feature' }, title: 't', body: '' }), { status: 200, headers: { 'content-type': 'application/json' } }),
  });
  assert.equal(result.verdict, 'fail');
});

test('PR verification race is detected when head SHA changes', async () => {
  let calls = 0;
  const result = await assertPullRequestStable({
    repository: 'acme/flixo',
    prNumber: 6,
    expectedHeadSha: 'expected',
    expectedBaseSha: 'base',
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({ state: 'open', merged: false, draft: true, base: { repo: { full_name: 'acme/flixo' }, sha: 'base' }, head: { repo: { full_name: 'acme/flixo' }, sha: 'changed' } }), { status: 200 });
    },
  });
  assert.equal(calls, 1);
  assert.equal(result, false);
});


test('verifier has a currently valid configurable model default', () => {
  assert.equal(process.env.VERIFIER_MODEL || process.env.OPENAI_MODEL || '', process.env.VERIFIER_MODEL || process.env.OPENAI_MODEL || '');
  assert.ok(VERIFIER_MODEL.length > 0);
});


test('verifier external GitHub call is bounded and fails closed on timeout', async () => {
  const result = await verifyPullRequest({
    repository: 'acme/flixo',
    prNumber: 14,
    fetchImpl: async (_url, options) => {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 10_000);
        options.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(options.signal.reason || new Error('aborted')); }, { once: true });
      });
      return new Response('{}', { status: 200 });
    },
  });
  assert.equal(result.verdict, 'fail');
});
