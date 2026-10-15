import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyAgentBlockedLabels } from './check-agent-blocked-channel.mjs';

test('agent-blocked channel requires canonical labels and exact identities', async () => {
  const seen = [];
  const fetchImpl = async url => {
    seen.push(url);
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop());
    return { ok: true, json: async () => ({ name, color: 'ededed' }) };
  };
  const result = await verifyAgentBlockedLabels({
    token: 'test-token',
    repo: 'm1m2m3m4m5m6m700-afk/FLIXO_Hub',
    fetchImpl,
  });
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.labels.map(x => x.name), ['agent-blocked', 'agent-blocked-global']);
  assert.equal(seen.length, 2);
});

test('agent-blocked channel fails closed on non-canonical repo or missing label', async () => {
  await assert.rejects(
    verifyAgentBlockedLabels({ token: 'test-token', repo: 'attacker/repo', fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }),
    /non-canonical repository/u,
  );
  await assert.rejects(
    verifyAgentBlockedLabels({
      token: 'test-token',
      repo: 'm1m2m3m4m5m6m700-afk/FLIXO_Hub',
      fetchImpl: async () => ({ ok: false, status: 404 }),
    }),
    /GitHub label API 404/u,
  );
});
