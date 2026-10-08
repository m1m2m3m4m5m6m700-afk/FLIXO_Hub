import assert from 'node:assert/strict';
import test from 'node:test';

import {
  quoteEconomyTask,
  validateEconomySettlement,
} from '../../../scripts/agent-learning/agent-economy.mjs';
import {
  assertExactSha,
  createMemoryEmbedding,
  preflightMemoryRetrieval,
  searchEpisodicExperiences,
  searchSharedMemorySemantic,
} from '../../../scripts/agent-learning/shared-memory.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';

test('memory execution remains exact-SHA bound and rejects stale memories', () => {
  const result = preflightMemoryRetrieval({
    currentSha: SHA,
    memories: [
      { memory_id: 'fresh', status: 'PROMOTED', tested_sha: SHA },
      { memory_id: 'stale', status: 'PROMOTED', tested_sha: 'fedcba9876543210fedcba9876543210fedcba98' },
      { memory_id: 'candidate', status: 'CANDIDATE', tested_sha: SHA },
    ],
  });

  assert.equal(result.executableMemory.length, 1);
  assert.equal(result.executableMemory[0].memory_id, 'fresh');
  assert.equal(result.blockedCount, 2);
});

test('semantic embedding client validates the 384-dimensional contract', async () => {
  const embedding = Array.from({ length: 384 }, (_, index) => index / 384);
  const fetchImpl = async (url, options) => {
    assert.match(String(url), /\/functions\/v1\/flixo-memory-embed$/u);
    assert.equal(options?.method, 'POST');
    return new Response(JSON.stringify({ model: 'gte-small', dimensions: 384, embedding }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await createMemoryEmbedding(
    'semantic memory test sentence',
    { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-key' },
    fetchImpl,
  );

  assert.equal(result.length, 384);

  const badFetch = async () => new Response(JSON.stringify({
    model: 'gte-small', dimensions: 3, embedding: [1, 2, 3],
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  await assert.rejects(
    () => createMemoryEmbedding(
      'semantic memory bad shape',
      { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-key' },
      badFetch,
    ),
    /MEMORY_EMBEDDING_SHAPE_INVALID/u,
  );
});

test('modern Supabase secret keys use apikey, not Authorization bearer', async () => {
  let requestHeaders = null;
  const fetchImpl = async (_url, options) => {
    requestHeaders = options.headers;
    return new Response(JSON.stringify({
      model: 'gte-small',
      dimensions: 384,
      embedding: Array.from({ length: 384 }, () => 0.01),
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  await createMemoryEmbedding(
    'modern secret key embedding request',
    {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_example',
    },
    fetchImpl,
  );

  assert.equal(requestHeaders.apikey, 'sb_secret_example');
  assert.equal('Authorization' in requestHeaders, false);
});

test('semantic search sends the exact SHA and embedding through the canonical RPC', async () => {
  const embedding = Array.from({ length: 384 }, () => 0.01);
  let requestBody = null;
  const fetchImpl = async (url, options) => {
    assert.match(String(url), /\/rest\/v1\/rpc\/flixo_search_agent_memory_semantic$/u);
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify([
      { memory_id: 'memory-1', status: 'PROMOTED', tested_sha: SHA, rank_score: 0.9 },
    ]), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const rows = await searchSharedMemorySemantic(
    { query: 'auth token failure', currentSha: SHA, limit: 8, embedding },
    { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-key', fetchImpl },
  );

  assert.equal(rows.length, 1);
  assert.equal(requestBody.p_current_sha, SHA);
  assert.equal(requestBody.p_query_embedding.length, 384);
});

test('episodic retrieval is current-SHA scoped', async () => {
  let requestUrl = '';
  const fetchImpl = async (url) => {
    requestUrl = String(url);
    return new Response(JSON.stringify([
      { learning_id: 'lesson-1', target_sha: SHA, task_id: 'TASK-1', claim: 'current failure lesson' },
    ]), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const rows = await searchEpisodicExperiences(
    { taskId: 'TASK-1', currentSha: SHA, limit: 10 },
    { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-key', fetchImpl },
  );

  assert.equal(rows.length, 1);
  assert.match(requestUrl, new RegExp('target_sha=eq\\.' + SHA));
  assert.equal(rows[0].memory_kind, 'EPISODIC');
});

test('economy client exposes bounded wallet discovery through Supabase REST', async () => {
  let requestUrl = '';
  const { createAgentEconomyClient } = await import('../../../scripts/agent-learning/agent-economy.mjs');
  const client = createAgentEconomyClient({
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-key' },
    fetchImpl: async (url) => {
      requestUrl = String(url);
      return new Response(JSON.stringify([{ agent_id: 'AGENT-01', role: 'SOLVER', reputation: 91 }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const rows = await client.listWallets({ minReputation: 90, limit: 10 });
  assert.equal(rows.length, 1);
  assert.match(requestUrl, /flixo_agent_economy_wallets/);
  assert.match(requestUrl, /reputation=gte\.90/);
  assert.match(requestUrl, /limit=10/);
});

test('economy pricing increases with difficulty and demand', () => {
  const easy = quoteEconomyTask({ difficulty: 1, baseReward: 100, openDemand: 0 });
  const hard = quoteEconomyTask({ difficulty: 10, baseReward: 100, openDemand: 20 });

  assert.ok(hard.quotedReward > easy.quotedReward);
  assert.equal(easy.stakeRequired, Math.ceil(easy.quotedReward * 0.25));
  assert.equal(hard.knowledgeTaxRate, 0.10);
  assert.equal(hard.successReturnMultiple, 2);
});

test('economy settlement is exact-SHA and requires an independent verifier', () => {
  assert.equal(
    validateEconomySettlement({
      taskExactSha: SHA,
      settlementExactSha: SHA,
      solverAgent: 'AGENT-01',
      verifierAgent: 'AGENT-02',
      outcome: 'SUCCESS',
    }),
    'SUCCESS',
  );

  assert.throws(
    () => validateEconomySettlement({
      taskExactSha: SHA,
      settlementExactSha: 'fedcba9876543210fedcba9876543210fedcba98',
      solverAgent: 'AGENT-01',
      verifierAgent: 'AGENT-02',
      outcome: 'SUCCESS',
    }),
    /ECONOMY_EXACT_SHA_MISMATCH/u,
  );

  assert.throws(
    () => validateEconomySettlement({
      taskExactSha: SHA,
      settlementExactSha: SHA,
      solverAgent: 'AGENT-01',
      verifierAgent: 'AGENT-01',
      outcome: 'SUCCESS',
    }),
    /INDEPENDENT_VERIFIER_REQUIRED/u,
  );

  assert.equal(assertExactSha(SHA), SHA);
});

await import('./agent-economy-settlement-sql-contract.test.mjs');

await import('./agent-economy-settlement-v3.test.mjs');
