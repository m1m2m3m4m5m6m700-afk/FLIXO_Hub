import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SHA_RE,
  buildKnowledgeKey,
  classifyKnowledgeForSha,
  isPromotableMemory,
  validateMemoryProposal,
  createSupabaseRpcClient,
} from '../../../scripts/agent-learning/shared-memory.mjs';

const SHA = '0000000000000000000000000000000000000001';
const OTHER_SHA = '0000000000000000000000000000000000000002';

test('shared-memory helpers enforce exact SHA', () => {
  assert.equal(SHA_RE.test(SHA), true);
  assert.equal(SHA_RE.test('bad-sha'), false);
  assert.equal(classifyKnowledgeForSha({ status: 'PROMOTED', tested_sha: SHA }, SHA).usable, true);
  assert.equal(classifyKnowledgeForSha({ status: 'PROMOTED', tested_sha: SHA }, OTHER_SHA).usable, false);
  assert.equal(classifyKnowledgeForSha({ status: 'PROMOTED', tested_sha: SHA }, OTHER_SHA).sha_freshness, 'STALE_EVIDENCE');
});

test('knowledge keys are deterministic and safe', () => {
  const a = buildKnowledgeKey({ kind: 'LESSON', claim: 'Re-read current SHA before evidence', scope: 'repository' });
  const b = buildKnowledgeKey({ kind: 'LESSON', claim: 'Re-read current SHA before evidence', scope: 'repository' });
  assert.equal(a, b);
  assert.match(a, /^[a-z0-9][a-z0-9._:-]{2,255}$/);
});

test('raw inbox routing is rejected and canonical reports are required', () => {
  const failures = validateMemoryProposal({
    agent: 'FLIXO Architecture Scout',
    role: 'architecture-research',
    exactSha: SHA,
    reportPath: '.agent-intelligence/inbox/proposal.yaml',
    kind: 'LESSON',
    claim: 'test',
    content: 'test',
    evidenceRefs: ['report:L1'],
  }, SHA);
  assert.ok(failures.includes('reportPath must be inside the canonical agent report center'));
  assert.ok(failures.includes('inbox path is forbidden'));
});

test('memory promotion needs independent evidence, repeated utility and regression', () => {
  const base = {
    status: 'VALIDATED',
    tested_sha: SHA,
    independent_confirmations: 2,
    helpful_count: 2,
    regression_evidence: true,
    harmful_count: 0,
  };
  assert.equal(isPromotableMemory(base, SHA), true);
  assert.equal(isPromotableMemory({ ...base, harmful_count: 1 }, SHA), false);
  assert.equal(isPromotableMemory({ ...base, independent_confirmations: 1 }, SHA), false);
  assert.equal(isPromotableMemory({ ...base, tested_sha: OTHER_SHA }, SHA), false);
  assert.equal(isPromotableMemory({ ...base, regression_evidence: false }, SHA), false);
});

test('RPC client uses service-only authorization without embedding secrets in payloads', async () => {
  const calls = [];
  const client = createSupabaseRpcClient({
    baseUrl: 'https://example.supabase.co',
    serviceRoleKey: 'secret',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, async json() { return [{ ok: true }]; }, async text() { return ''; } };
    },
  });
  const result = await client.call('flixo_search_agent_memory', {
    p_query: 'architecture',
    p_current_sha: SHA,
    p_limit: 5,
    p_include_candidates: false,
  });
  assert.deepEqual(result, [{ ok: true }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://example.supabase.co/rest/v1/rpc/flixo_search_agent_memory');
  assert.equal(calls[0].options.headers.apikey, 'secret');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret');
  assert.equal(JSON.stringify(calls[0].options.body).includes('secret'), false);
});
