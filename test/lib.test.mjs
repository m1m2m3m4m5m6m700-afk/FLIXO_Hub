import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  Budget,
  BudgetExceededError,
  StaleCheckpointError,
  heartbeat,
  loadCheckpoint,
  saveCheckpoint,
  withRetry,
} from '../scripts/agent/lib.mjs';

test('withRetry retries transient failures with a bounded attempt count', async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls += 1;
    if (calls < 3) throw new Error('transient');
    return 'ok';
  }, { retries: 3, baseDelayMs: 1 });
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
});

test('Budget reserve/refund/spend enforces used + requested <= max', () => {
  const budget = new Budget(10);
  budget.reserve(4);
  assert.equal(budget.remaining, 6);
  budget.refund(2);
  assert.equal(budget.remaining, 8);
  budget.spend(6);
  assert.equal(budget.used, 6);
  assert.equal(budget.remaining, 2);
  assert.throws(() => budget.reserve(3), BudgetExceededError);
  assert.equal(budget.used, 6);
});

test('checkpoint sequence is monotonic and rejects stale writers', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'flixo-agent-'));
  const file = join(dir, 'checkpoint.json');
  try {
    const first = await saveCheckpoint(file, { state: 'one' }, { expectedSeq: 0 });
    const second = await saveCheckpoint(file, { state: 'two' }, { expectedSeq: first.__seq });
    assert.equal(first.__seq, 1);
    assert.equal(second.__seq, 2);
    assert.ok(second.__ts);
    await assert.rejects(
      saveCheckpoint(file, { state: 'stale' }, { expectedSeq: 1 }),
      StaleCheckpointError,
    );
    const loaded = await loadCheckpoint(file, {});
    assert.equal(loaded.state, 'two');
    assert.equal(loaded.__seq, 2);
    assert.match(await readFile(file, 'utf8'), /"__seq": 2/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkpoint writer creates missing state directory atomically', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'flixo-agent-nested-'));
  const file = join(dir, 'nested', 'checkpoint.json');
  try {
    const saved = await saveCheckpoint(file, { state: 'created' }, { expectedSeq: 0 });
    assert.equal(saved.__seq, 1);
    assert.equal((await loadCheckpoint(file)).state, 'created');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('heartbeat sends bounded watchdog state and authentication without leaking token in payload', async () => {
  const original = process.env.AGENT_TOKEN;
  process.env.AGENT_TOKEN = 'secret-heartbeat';
  let received;
  try {
    const ok = await heartbeat({
      watchdogUrl: 'https://watchdog.example/heartbeat',
      agentToken: 'secret-heartbeat',
      run_url: 'https://github.com/acme/flixo/actions/runs/7',
      seq: 8,
      task_id: 'issue:abc',
      last_checkpoint: '/tmp/checkpoint.json',
      pending: true,
      status: 'running',
      fetchImpl: async (_url, options) => {
        received = { headers: options.headers, body: JSON.parse(options.body) };
        return new Response('{}', { status: 200 });
      },
    });
    assert.equal(ok, true);
    assert.equal(received.body.seq, 8);
    assert.equal(received.body.pending, true);
    assert.equal(received.body.task_id, 'issue:abc');
    assert.match(received.headers.authorization, /^Bearer /u);
    assert.equal(JSON.stringify(received.body).includes('secret-heartbeat'), false);
  } finally {
    if (original === undefined) delete process.env.AGENT_TOKEN;
    else process.env.AGENT_TOKEN = original;
  }
});

test('heartbeat failure is warning-only and returns false', async () => {
  let called = false;
  const ok = await heartbeat({
    watchdogUrl: 'https://watchdog.invalid/heartbeat',
    seq: 4,
    task_id: 'task-1',
    last_checkpoint: '/tmp/checkpoint',
    pending: true,
    fetchImpl: async () => {
      called = true;
      throw new Error('offline');
    },
    timeoutMs: 100,
  });
  assert.equal(called, true);
  assert.equal(ok, false);
});
