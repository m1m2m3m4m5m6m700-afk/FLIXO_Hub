import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { BudgetExceededError } from '../scripts/agent/lib.mjs';
import { run } from '../scripts/agent/run.mjs';

function task(number) {
  const repository = 'acme/flixo';
  return { id: `issue:${createHash('sha256').update(`${repository}#${number}`).digest('hex').slice(0,32)}`, repository, number, title: 't', body: 'b', url: `https://github.com/acme/flixo/issues/${number}` };
}

async function tempCheckpoint() {
  const dir = await mkdtemp(join(tmpdir(), 'flixo-run-'));
  return { dir, path: join(dir, 'checkpoint.json') };
}

test('run retries immediately and marks dead at MAX_ATTEMPTS', async () => {
  const { dir, path } = await tempCheckpoint();
  const t = task(1);
  let calls = 0;
  try {
    const result = await run({
      checkpointPath: path,
      discover: async () => [t],
      processTaskImpl: async () => { calls += 1; throw new Error('nope'); },
      heartbeatImpl: async () => true,
      save: async (file, state, opts) => {
        const { saveCheckpoint } = await import('../scripts/agent/lib.mjs');
        return saveCheckpoint(file, state, opts);
      },
      batchMs: 0,
      maxAttempts: 2,
      maxChain: 5,
      taskHardMs: 1_000,
    });
    assert.equal(calls, 2);
    assert.equal(result.status, 'idle');
    const stored = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(stored.attempts[t.id], 'dead');
    assert.equal(stored.tasks[t.id], 'dead');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('run task hard timeout is converted to bounded retry/dead state', async () => {
  const { dir, path } = await tempCheckpoint();
  const t = task(4);
  try {
    const result = await run({
      checkpointPath: path,
      discover: async () => [t],
      processTaskImpl: async () => new Promise(() => {}),
      heartbeatImpl: async () => true,
      batchMs: 0,
      maxAttempts: 1,
      maxChain: 2,
      taskHardMs: 20,
    });
    assert.equal(result.status, 'idle');
    const stored = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(stored.tasks[t.id], 'dead');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('chain guard stops bounded continuation after MAX_CHAIN', async () => {
  const { dir, path } = await tempCheckpoint();
  const t = task(2);
  try {
    const seed = JSON.stringify({ __seq: 1, __ts: new Date().toISOString(), attempts: {}, tasks: {}, pending: [t.id], chain: 1, status: 'dispatched' });
    await (await import('node:fs/promises')).writeFile(path, seed, 'utf8');
    let dispatched = 0;
    const result = await run({
      checkpointPath: path,
      discover: async () => [t],
      processTaskImpl: async () => ({ progress: false, status: 'retry' }),
      dispatch: async () => { dispatched += 1; },
      heartbeatImpl: async () => true,
      batchMs: 0,
      maxAttempts: 1,
      maxChain: 1,
      taskHardMs: 1_000,
    });
    assert.equal(dispatched, 0);
    assert.equal(result.status, 'chain-limit');
    const stored = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(stored.status, 'chain-limit');
    assert.equal(stored.chain, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('budget exhaustion checkpoints, heartbeats failure, and stops current run', async () => {
  const { dir, path } = await tempCheckpoint();
  const t = task(3);
  const heartbeats = [];
  try {
    const result = await run({
      checkpointPath: path,
      discover: async () => [t],
      processTaskImpl: async () => { throw new BudgetExceededError(1, 1, 1); },
      heartbeatImpl: async (payload) => { heartbeats.push(payload); return false; },
      batchMs: 0,
      maxAttempts: 3,
      taskHardMs: 1_000,
    });
    assert.equal(result.status, 'budget-exhausted');
    assert.equal(heartbeats.at(-1).status, 'failed');
    const stored = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(stored.status, 'budget-exhausted');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
