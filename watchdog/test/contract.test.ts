import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { AgentState } from '../src/durable.ts';
import worker from '../src/index.ts';
import type { DurableObjectStorageLike, Env } from '../src/lib/types.ts';
import {
  DEFAULT_CONFIG,
  GitHubClient,
  HttpError,
  Metrics,
  allowRate,
  authAdmin,
  authAgent,
  decide,
  heartbeatBody,
  loadConfig,
  readBody,
  readJson,
  runUrl,
  rpc,
  stub,
} from '../src/lib/runtime.ts';

class MemoryStorage implements DurableObjectStorageLike {
  private readonly data = new Map<string, unknown>();
  private tail = Promise.resolve();

  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async deleteAll(): Promise<void> {
    this.data.clear();
  }

  async transaction<T>(callback: (tx: DurableObjectStorageLike) => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await callback(this);
    } finally {
      release();
    }
  }
}

class FakeNamespace {
  private readonly states = new Map<string, AgentState>();

  idFromName(name: string) {
    return { name };
  }

  get(id: { name: string }) {
    let state = this.states.get(id.name);
    if (!state) {
      state = new AgentState({ id, storage: new MemoryStorage() });
      this.states.set(id.name, state);
    }
    return {
      fetch: (request: Request) => state!.fetch(request),
    };
  }

  setState(name: string, state: AgentState) {
    this.states.set(name, state);
  }

  state(name: string) {
    return this.states.get(name);
  }
}

const baseEnv = (overrides: Partial<Env> = {}): Env => ({
  AGENT_STATE: new FakeNamespace(),
  AGENT_TOKEN: 'agent-secret',
  AGENT_TOKEN_PREV: 'old-secret',
  ADMIN_TOKEN: 'admin-secret',
  WATCHDOG_AGENTS: 'alpha,beta',
  ...overrides,
});

const envFor = (overrides: Partial<Env> = {}): Env => baseEnv(overrides);
const newState = () => new AgentState({ id: { name: 'alpha' }, storage: new MemoryStorage() });

test('LINEARIZABLE_CHECKPOINT=PASS', async () => {
  const state = new AgentState({ id: { name: 'alpha' }, storage: new MemoryStorage() });
  const results = await Promise.all(
    Array.from({ length: 8 }, () => state.setCheckpoint(1, 'same')),
  );
  assert.equal(results.filter((x) => x.accepted).length, 1);
  assert.equal((await state.getCheckpoint()).checkpointSeq, 1);
  assert.equal((await state.setCheckpoint(0, 'stale')).accepted, false);
});

test('ATOMIC_FAILURE_COUNTER=PASS', async () => {
  const state = new AgentState({ id: { name: 'alpha' }, storage: new MemoryStorage() });
  const results = await Promise.all(
    Array.from({ length: 10 }, () => state.bumpFailure(3)),
  );
  const snapshot = await state.getFailureState();
  assert.equal(snapshot.consecutiveFails, 3);
  assert.equal(snapshot.breakerTripped, true);
  assert.equal(results.filter((x) => x.trippedNow).length, 1);
});

test('completion resets the counter but breaker remains independent', async () => {
  const state = new AgentState({ id: { name: 'alpha' }, storage: new MemoryStorage() });
  await state.bumpFailure(2);
  await state.bumpFailure(2);
  const result = await state.recordHeartbeat({
    agentId: 'alpha',
    status: 'completed',
    pending: 0,
    receivedAt: Date.now() + 1,
  }, 2);
  assert.equal(result.consecutiveFails, 0);
  assert.equal(result.breakerTripped, true);
  await state.resetBreaker();
  assert.equal((await state.getFailureState()).breakerTripped, false);
});

test('BOUNDED_DISPATCH=PASS and BREAKERR=PASS', async () => {
  const state = new AgentState({ id: { name: 'alpha' }, storage: new MemoryStorage() });
  const t = 1_000_000;
  for (let i = 0; i < 4; i += 1) {
    const result = await state.reserveDispatch({
      agentId: 'alpha',
      workflow: 'dispatch.yml',
      reason: 'failed',
    }, t + i * 15 * 60_000, 4, 60 * 60_000, 15);
    assert.equal(result.accepted, true);
  }
  const limited = await state.reserveDispatch({
    agentId: 'alpha',
    workflow: 'dispatch.yml',
    reason: 'failed',
  }, t + 60 * 60_000, 4, 60 * 60_000, 15);
  assert.equal(limited.accepted, false);
  if (!limited.accepted) assert.equal(limited.reason, 'hourly-limit');

  await state.tripBreaker();
  const blocked = await state.reserveDispatch({
    agentId: 'alpha',
    workflow: 'dispatch.yml',
    reason: 'failed',
  }, t + 61 * 60_000, 4, 60 * 60_000, 15);
  assert.deepEqual(blocked, { accepted: false, reason: 'breaker' });
});

test('AUTH_FAIL_CLOSED=PASS', async () => {
  const env = baseEnv();
  const metrics = new Metrics();

  await assert.rejects(
    authAgent(new Request('https://watchdog.test/heartbeat'), env, metrics),
    (error: unknown) => error instanceof HttpError && error.status === 401,
  );
  await assert.rejects(
    authAdmin(new Request('https://watchdog.test/metrics'), env, metrics),
    (error: unknown) => error instanceof HttpError && error.status === 401,
  );

  await assert.rejects(
    authAgent(new Request('https://watchdog.test/heartbeat', {
      headers: { Authorization: 'Bearer old-secret' },
    }), env, metrics),
    (error: unknown) => error instanceof HttpError && error.status === 401,
  );
  await authAdmin(new Request('https://watchdog.test/metrics', {
    headers: { Authorization: 'Bearer admin-secret' },
  }), env, metrics);

  assert.equal(metrics.snapshot().auth_denied, 3);
});

test('BODY_LIMIT=PASS', async () => {
  await assert.rejects(
    readBody(new Request('https://watchdog.test', {
      method: 'POST',
      body: '12345678901',
    }), 10),
    (error: unknown) => error instanceof HttpError && error.status === 413,
  );
});

test('SSRF_GUARD=PASS', () => {
  assert.equal(
    runUrl('https://github.com/owner/repo/actions/runs/42', 'owner/repo', DEFAULT_CONFIG),
    'https://github.com/owner/repo/actions/runs/42',
  );
  assert.equal(
    runUrl('https://api.github.com/repos/owner/repo/actions/runs/42', 'owner/repo', DEFAULT_CONFIG),
    'https://api.github.com/repos/owner/repo/actions/runs/42',
  );
  assert.throws(
    () => runUrl('https://evil.example/owner/repo/actions/runs/42', 'owner/repo', DEFAULT_CONFIG),
    /UNSAFE_RUN_URL/,
  );
  assert.throws(
    () => runUrl('https://github.com/owner/other/actions/runs/42', 'owner/repo', DEFAULT_CONFIG),
    /UNSAFE_RUN_URL/,
  );
  assert.throws(
    () => runUrl('https://github.com/owner/repo/actions/runs/42?x=1', 'owner/repo', DEFAULT_CONFIG),
    /UNSAFE_RUN_URL/,
  );
});

test('invalid configuration fails closed', () => {
  assert.equal(loadConfig({
    ...baseEnv(),
    GITHUB_TOKEN: 'secret',
    GITHUB_REPOSITORY: 'owner',
    GITHUB_DISPATCH_WORKFLOW: 'dispatch.yml',
  }), null);

  assert.equal(loadConfig({
    ...baseEnv(),
    GITHUB_TOKEN: 'secret',
    GITHUB_REPOSITORY: 'owner/repo',
    GITHUB_DISPATCH_WORKFLOW: '../dispatch.yml',
  }), null);
});

test('heartbeat validation is bounded and identity-safe', () => {
  const info = loadConfig(baseEnv());
  assert.ok(info);

  assert.throws(
    () => heartbeatBody({
      agent_id: 'alpha',
      status: 'running',
      pending: Number.MAX_SAFE_INTEGER + 1,
    }, info.config, info.agents, undefined, []),
    /INVALID_PENDING/,
  );

  assert.throws(
    () => heartbeatBody({
      agent_id: 'alpha',
      status: 'running',
      pending: 0,
      run_id: 42,
    }, info.config, info.agents, undefined, []),
    /WORKFLOW_REQUIRED/,
  );
});

test('rate limiting is identity scoped and forget purges it atomically', async () => {
  const env = baseEnv();
  const fpA = 'a'.repeat(64);
  const fpB = 'b'.repeat(64);

  assert.equal(await allowRate(env, fpA, 'alpha', 'heartbeat', DEFAULT_CONFIG), true);
  assert.equal(await allowRate(env, fpA, 'alpha', 'heartbeat', DEFAULT_CONFIG), true);
  assert.equal(await allowRate(env, fpB, 'alpha', 'heartbeat', DEFAULT_CONFIG), true);

  const namespace = env.AGENT_STATE as FakeNamespace;
  const state = namespace.state('alpha');
  assert.ok(state);
  await state.forget();

  assert.equal(await allowRate(env, fpA, 'alpha', 'heartbeat', DEFAULT_CONFIG), true);
});

test('GitHub client enforces explicit target and success statuses', async () => {
  const env = baseEnv();
  env.GITHUB_TOKEN = 'gh-secret';
  const config = {
    repository: 'owner/repo',
    workflow: 'dispatch.yml',
    ref: 'execution',
    apiVersion: '2026-03-10',
    autoDispatch: false,
    enableCancel: true,
    allowedWorkflows: ['dispatch.yml'],
    githubTimeoutMs: 5000,
    maxResponseBytes: 16 * 1024,
  };

  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input: URL | RequestInfo) => {
    calls.push(String(input));
    return new Response(null, { status: 204 });
  };

  try {
    await new GitHubClient(env, config).dispatch('alpha', 'failed');
    assert.equal(
      calls[0],
      'https://api.github.com/repos/owner/repo/actions/workflows/dispatch.yml/dispatches',
    );

    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }), { status: 500 });
    await assert.rejects(
      new GitHubClient(env, config).run(42),
      /GITHUB_HTTP_500/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('CONSERVATIVE_CANCEL=PASS', async () => {
  const env = baseEnv();
  const namespace = env.AGENT_STATE as FakeNamespace;
  const state = new AgentState({
    id: { name: 'alpha' },
    storage: new MemoryStorage(),
  });
  namespace.setState('alpha', state);

  await state.recordHeartbeat({
    agentId: 'alpha',
    status: 'running',
    pending: 0,
    workflow: 'dispatch.yml',
    runId: 42,
    runUrl: 'https://github.com/owner/repo/actions/runs/42',
    receivedAt: Date.now() - DEFAULT_CONFIG.cancelStaleRunningMs - 10_000,
  }, DEFAULT_CONFIG.maxConsecutiveFails);

  env.GITHUB_TOKEN = 'gh-secret';
  env.GITHUB_REPOSITORY = 'owner/repo';
  env.GITHUB_DISPATCH_WORKFLOW = 'dispatch.yml';
  env.GITHUB_DISPATCH_REF = 'execution';
  env.WATCHDOG_AGENTS = 'alpha';
  env.WATCHDOG_AUTO_DISPATCH = '0';
  env.WATCHDOG_ENABLE_HUNG_CANCEL = '1';

  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = async (input: URL | RequestInfo) => {
    calls.push(String(input));
    if (String(input).endsWith('/cancel')) {
      return new Response('', { status: 202 });
    }
    return new Response(JSON.stringify({
      id: 42,
      status: 'in_progress',
      name: 'dispatch.yml',
      path: '.github/workflows/dispatch.yml',
      repository: { full_name: 'owner/repo' },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const metrics = new Metrics();
    await decide(env, metrics);

    assert.equal(calls.length, 2);
    assert.equal(calls[0], 'https://api.github.com/repos/owner/repo/actions/runs/42');
    assert.equal(calls[1], 'https://api.github.com/repos/owner/repo/actions/runs/42/cancel');

    const log = await state.getDispatchLog();
    assert.equal(log.at(-1)?.result, 'cancelled');
    assert.equal(log.at(-1)?.reason, 'cancellation');
    assert.equal(metrics.snapshot().verify_pass, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('conservative cancellation refuses workflow identity mismatch', async () => {
  const env = baseEnv();
  const namespace = env.AGENT_STATE as FakeNamespace;
  const state = new AgentState({
    id: { name: 'alpha' },
    storage: new MemoryStorage(),
  });
  namespace.setState('alpha', state);

  await state.recordHeartbeat({
    agentId: 'alpha',
    status: 'running',
    pending: 0,
    workflow: 'dispatch.yml',
    runId: 42,
    runUrl: 'https://api.github.com/repos/owner/repo/actions/runs/42',
    receivedAt: Date.now() - DEFAULT_CONFIG.cancelStaleRunningMs - 10_000,
  }, DEFAULT_CONFIG.maxConsecutiveFails);

  env.GITHUB_TOKEN = 'gh-secret';
  env.GITHUB_REPOSITORY = 'owner/repo';
  env.GITHUB_DISPATCH_WORKFLOW = 'dispatch.yml';
  env.WATCHDOG_AGENTS = 'alpha';
  env.WATCHDOG_AUTO_DISPATCH = '0';
  env.WATCHDOG_ENABLE_HUNG_CANCEL = '1';

  const originalFetch = globalThis.fetch;
  let cancelCalled = false;
  globalThis.fetch = async (input: URL | RequestInfo) => {
    if (String(input).endsWith('/cancel')) cancelCalled = true;
    return new Response(JSON.stringify({
      status: 'in_progress',
      name: 'other.yml',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    await decide(env, new Metrics());
    assert.equal(cancelCalled, false);
    assert.deepEqual(await state.getDispatchLog(), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('NO_SECRET_LOGGING=PASS and fixed metrics contract', () => {
  const metrics = new Metrics();
  assert.deepEqual(Object.keys(metrics.snapshot()), [
    'auth_denied',
    'heartbeat_invalid',
    'rate_limit_hit',
    'hb_running',
    'hb_completed',
    'hb_failed',
    'dispatch_ok',
    'dispatch_fail',
    'verify_pass',
    'verify_fail',
    'breaker_trip',
    'limit_hit',
  ]);
});


test('LINEARIZABLE_CHECKPOINT race preserves the highest accepted sequence', async () => {
  const state = new AgentState({ id: { name: 'alpha' }, storage: new MemoryStorage() });
  const sequences = [4, 1, 7, 3, 9, 2, 8, 5, 6];
  const results = await Promise.all(sequences.map((seq) => state.setCheckpoint(seq, String(seq))));
  assert.ok(results.some((result) => result.accepted));
  const final = await state.getCheckpoint();
  assert.equal(final.checkpointSeq, 9);
  assert.equal(final.checkpoint, '9');
  assert.equal((await state.setCheckpoint(8, 'stale')).accepted, false);
  assert.equal((await state.setCheckpoint(10, 'latest')).accepted, true);
});

test('ATOMIC_FAILURE_COUNTER race is bounded and breaker transition is single-shot', async () => {
  const state = new AgentState({ id: { name: 'alpha' }, storage: new MemoryStorage() });
  const results = await Promise.all(
    Array.from({ length: 64 }, () => state.bumpFailure(DEFAULT_CONFIG.maxConsecutiveFails)),
  );
  const snapshot = await state.getFailureState();
  assert.equal(snapshot.consecutiveFails, DEFAULT_CONFIG.maxConsecutiveFails);
  assert.equal(snapshot.breakerTripped, true);
  assert.equal(results.filter((result) => result.trippedNow).length, 1);
  assert.ok(results.every((result) => result.consecutiveFails <= DEFAULT_CONFIG.maxConsecutiveFails));
});

test('completion clears only consecutive failures and never clears the breaker', async () => {
  const state = new AgentState({ id: { name: 'alpha' }, storage: new MemoryStorage() });
  for (let i = 0; i < DEFAULT_CONFIG.maxConsecutiveFails; i += 1) await state.bumpFailure(DEFAULT_CONFIG.maxConsecutiveFails);
  const result = await state.recordHeartbeat({
    agentId: 'alpha',
    status: 'completed',
    pending: 0,
    receivedAt: Date.now() + 1,
  }, DEFAULT_CONFIG.maxConsecutiveFails);
  assert.equal(result.consecutiveFails, 0);
  assert.equal(result.breakerTripped, true);
  assert.equal((await state.resetFailure()).breakerTripped, true);
  assert.equal((await state.resetBreaker()).breakerTripped, false);
});

test('BOUNDED_DISPATCH race reserves before any external call and keeps the log append-only', async () => {
  const state = new AgentState({ id: { name: 'alpha' }, storage: new MemoryStorage() });
  const t = 2_000_000;
  const raced = await Promise.all(Array.from({ length: 32 }, () => state.reserveDispatch({
    agentId: 'alpha',
    workflow: 'dispatch.yml',
    reason: 'failed',
  }, t, 1, DEFAULT_CONFIG.dispatchWindowMs, 0)));
  assert.equal(raced.filter((result) => result.accepted).length, 1);

  const secondBeforeGap = await state.reserveDispatch({
    agentId: 'alpha',
    workflow: 'dispatch.yml',
    reason: 'failed',
  }, t + 1, 1, DEFAULT_CONFIG.dispatchWindowMs, 15);
  assert.equal(secondBeforeGap.accepted, false);
  if (!secondBeforeGap.accepted) assert.equal(secondBeforeGap.reason, 'hourly-limit');

  const before = await state.getDispatchLog();
  await state.appendDispatch({
    timestamp: t + 2,
    agentId: 'alpha',
    workflow: 'dispatch.yml',
    result: 'ok',
    reason: 'manual',
  });
  const after = await state.getDispatchLog();
  assert.deepEqual(after.slice(0, before.length), before);
  assert.equal(after.at(-1)?.result, 'ok');
});

test('BOUNDED_DISPATCH minimum-gap boundary is deterministic', async () => {
  const state = new AgentState({ id: { name: 'alpha' }, storage: new MemoryStorage() });
  const t = 3_000_000;
  assert.equal((await state.reserveDispatch({
    agentId: 'alpha',
    workflow: 'dispatch.yml',
    reason: 'manual',
  }, t, 4, DEFAULT_CONFIG.dispatchWindowMs, 15)).accepted, true);
  const beforeGap = await state.reserveDispatch({
    agentId: 'alpha',
    workflow: 'dispatch.yml',
    reason: 'manual',
  }, t + 15 * 60_000 - 1, 4, DEFAULT_CONFIG.dispatchWindowMs, 15);
  assert.equal(beforeGap.accepted, false);
  if (!beforeGap.accepted) assert.equal(beforeGap.reason, 'min-gap');
  assert.equal((await state.reserveDispatch({
    agentId: 'alpha',
    workflow: 'dispatch.yml',
    reason: 'manual',
  }, t + 15 * 60_000, 4, DEFAULT_CONFIG.dispatchWindowMs, 15)).accepted, true);
});

test('BODY_LIMIT rejects Content-Length lies, streaming overflow, malformed UTF-8, malformed JSON, and oversized nested payloads', async () => {
  await assert.rejects(
    readBody(new Request('https://watchdog.test', {
      method: 'POST',
      body: 'ok',
      headers: { 'Content-Length': String(DEFAULT_CONFIG.maxBodyBytes + 1) },
    }), DEFAULT_CONFIG.maxBodyBytes),
    (error: unknown) => error instanceof HttpError && error.status === 413,
  );

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(DEFAULT_CONFIG.maxBodyBytes));
      controller.enqueue(new Uint8Array([1]));
      controller.close();
    },
  });
  await assert.rejects(
    readBody(new Request('https://watchdog.test', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' }), DEFAULT_CONFIG.maxBodyBytes),
    (error: unknown) => error instanceof HttpError && error.status === 413,
  );

  await assert.rejects(
    readBody(new Request('https://watchdog.test', {
      method: 'POST',
      body: new Uint8Array([0xc3, 0x28]),
    }), DEFAULT_CONFIG.maxBodyBytes),
    (error: unknown) => error instanceof HttpError && error.code === 'INVALID_UTF8',
  );

  await assert.rejects(
    readJson(new Request('https://watchdog.test', {
      method: 'POST',
      body: '{"broken":',
    }), DEFAULT_CONFIG.maxBodyBytes),
    (error: unknown) => error instanceof HttpError && error.code === 'INVALID_JSON',
  );

  const nested = JSON.stringify({ payload: Array.from({ length: 50_000 }, (_, index) => ({ index, nested: true })) });
  assert.ok(new TextEncoder().encode(nested).byteLength > DEFAULT_CONFIG.maxBodyBytes);
  await assert.rejects(
    readJson(new Request('https://watchdog.test', { method: 'POST', body: nested }), DEFAULT_CONFIG.maxBodyBytes),
    (error: unknown) => error instanceof HttpError && error.status === 413,
  );
});

test('AUTH_FAIL_CLOSED rejects all credential failure modes and never exposes protected endpoint without current token', async () => {
  const env = baseEnv();
  const metrics = new Metrics();
  for (const authorization of [undefined, 'Bearer', 'Basic agent-secret', 'Bearer wrong-secret', 'Bearer old-secret']) {
    const req = authorization === undefined
      ? new Request('https://watchdog.test/heartbeat')
      : new Request('https://watchdog.test/heartbeat', { headers: { Authorization: authorization } });
    await assert.rejects(authAgent(req, env, metrics), (error: unknown) => error instanceof HttpError && error.status === 401);
  }
  await authAgent(new Request('https://watchdog.test/heartbeat', {
    headers: { Authorization: 'Bearer agent-secret' },
  }), env, metrics);
  await assert.rejects(
    authAdmin(new Request('https://watchdog.test/metrics', { headers: { Authorization: 'Bearer admin-secret' } }), { ...env, ADMIN_TOKEN: undefined }, metrics),
    (error: unknown) => error instanceof HttpError && error.status === 401,
  );
  const publicFallback = await worker.fetch(new Request('https://watchdog.test/heartbeat', {
    method: 'POST',
    body: JSON.stringify({ agent_id: 'alpha', status: 'running', pending: 0 }),
    headers: { 'content-type': 'application/json' },
  }), { ...env, AGENT_TOKEN: undefined, ADMIN_TOKEN: undefined });
  assert.equal(publicFallback.status, 401);
});

test('RATE_LIMIT_DETERMINISTIC race separates identity and buckets, honors window boundary, and fails closed on corrupt state', async () => {
  const state = new AgentState({ id: { name: 'alpha' }, storage: new MemoryStorage() });
  const fpA = 'a'.repeat(64);
  const fpB = 'b'.repeat(64);
  const t = 5_000_000;
  const results = await Promise.all(
    Array.from({ length: 20 }, () => state.consumeRateLimit('heartbeat', fpA, t, 60_000, 3)),
  );
  assert.equal(results.filter((result) => result.allowed).length, 3);
  assert.equal((await state.consumeRateLimit('mutation', fpA, t, 60_000, 3)).allowed, true);
  assert.equal((await state.consumeRateLimit('heartbeat', fpB, t, 60_000, 3)).allowed, true);
  assert.equal((await state.consumeRateLimit('heartbeat', fpA, t + 59_999, 60_000, 3)).allowed, false);
  assert.equal((await state.consumeRateLimit('heartbeat', fpA, t + 60_000, 60_000, 3)).allowed, true);

  const corrupt = new MemoryStorage();
  await corrupt.put('rate:v1:' + fpA + ':heartbeat', {
    bucket: 'heartbeat',
    windowStart: t,
    count: -1,
  });
  await assert.rejects(
    new AgentState({ id: { name: 'alpha' }, storage: corrupt }).consumeRateLimit('heartbeat', fpA, t, 60_000, 3),
    /CORRUPT_RATE_STATE/,
  );
});

test('RPC_APPEND_DISPATCH route preserves cancellation records', async () => {
  const env = baseEnv({ WATCHDOG_AGENTS: 'alpha' });
  const state = newState();
  (env.AGENT_STATE as FakeNamespace).setState('alpha', state);
  await rpc(await stub(env, 'alpha'), 'appendDispatch', {
    timestamp: Date.now(),
    agentId: 'alpha',
    workflow: 'dispatch.yml',
    runIdentity: '42',
    result: 'cancelled',
    reason: 'cancellation',
  });
  const log = await state.getDispatchLog();
  assert.equal(log.at(-1)?.result, 'cancelled');
  assert.equal(log.at(-1)?.reason, 'cancellation');
});

test('FORGET/PURGE removes state, heartbeat, dispatch log, breaker and rate state', async () => {
  const state = newState();
  const fp = 'c'.repeat(64);
  await state.setCheckpoint(4, 'checkpoint');
  await state.bumpFailure(DEFAULT_CONFIG.maxConsecutiveFails);
  await state.recordHeartbeat({
    agentId: 'alpha',
    status: 'failed',
    pending: 0,
    receivedAt: Date.now() + 1,
  }, DEFAULT_CONFIG.maxConsecutiveFails);
  await state.appendDispatch({
    timestamp: Date.now() + 2,
    agentId: 'alpha',
    workflow: 'dispatch.yml',
    result: 'ok',
    reason: 'manual',
  });
  await state.consumeRateLimit('heartbeat', fp, Date.now() + 3, 60_000, 2);
  await state.forget();
  assert.deepEqual(await state.getSnapshot(), { state: null, heartbeat: null });
  assert.equal((await state.consumeRateLimit('heartbeat', fp, Date.now() + 4, 60_000, 2)).allowed, true);
});

test('CORRUPT_STATE_FAIL_CLOSED rejects corrupt checkpoint, failure, breaker, dispatch log, heartbeat, and rate state', async () => {
  const stateCorruptions: unknown[] = [
    { agentId: 'alpha', checkpointSeq: -1, consecutiveFails: 0, breakerTripped: false, dispatches: [], updatedAt: Date.now() },
    { agentId: 'alpha', checkpointSeq: 1, consecutiveFails: DEFAULT_CONFIG.maxConsecutiveFails * 1024 + 1, breakerTripped: false, dispatches: [], updatedAt: Date.now() },
    { agentId: 'alpha', checkpointSeq: 1, consecutiveFails: 0, breakerTripped: 'yes', dispatches: [], updatedAt: Date.now() },
    { agentId: 'alpha', checkpointSeq: 1, consecutiveFails: 0, breakerTripped: false, dispatches: [{ timestamp: 1, agentId: 'alpha', workflow: '../evil', result: 'ok', reason: 'manual' }], updatedAt: Date.now() },
    { agentId: 'alpha', checkpointSeq: 1, checkpoint: 'x'.repeat(DEFAULT_CONFIG.maxCheckpointBytes + 1), consecutiveFails: 0, breakerTripped: false, dispatches: [], updatedAt: Date.now() },
  ];
  for (const corruption of stateCorruptions) {
    const storage = new MemoryStorage();
    await storage.put('state:v1', corruption);
    await assert.rejects(
      new AgentState({ id: { name: 'alpha' }, storage }).getSnapshot(),
      /CORRUPT_DO_(STATE|LOG)/,
    );
  }

  const heartbeatStorage = new MemoryStorage();
  await heartbeatStorage.put('heartbeat:v1', { agentId: 'alpha', status: 'running', pending: 0, receivedAt: -1 });
  await assert.rejects(
    new AgentState({ id: { name: 'alpha' }, storage: heartbeatStorage }).getHeartbeat(),
    /CORRUPT_DO_HEARTBEAT/,
  );

  const rateStorage = new MemoryStorage();
  const fp = 'd'.repeat(64);
  await rateStorage.put('rate:v1:' + fp + ':heartbeat', { bucket: 'heartbeat', windowStart: Date.now(), count: 'NaN' });
  await assert.rejects(
    new AgentState({ id: { name: 'alpha' }, storage: rateStorage }).consumeRateLimit('heartbeat', fp, Date.now(), 60_000, 3),
    /CORRUPT_RATE_STATE/,
  );
});

test('SSRF_GUARD rejects all non-canonical GitHub run URLs', () => {
  const bad = [
    'https://evil.example/owner/repo/actions/runs/42',
    'http://github.com/owner/repo/actions/runs/42',
    'https://user:pass@github.com/owner/repo/actions/runs/42',
    'https://github.com/owner/repo/actions/runs/42?x=1',
    'https://github.com/owner/repo/actions/runs/42#frag',
    'https://github.com/owner/other/actions/runs/42',
    'https://api.github.com/repos/owner/other/actions/runs/42',
    'https://api.github.com/repos/owner/repo/actions/runs/42/extra/43',
    'https://api.github.com/repos/owner/repo/actions/runs/not-a-run',
  ];
  for (const value of bad) assert.throws(
    () => runUrl(value, 'owner/repo', DEFAULT_CONFIG),
    /UNSAFE_RUN_URL/,
  );
  assert.throws(
    () => runUrl('https://api.github.com/repos/owner/repo/actions/runs/42', undefined, DEFAULT_CONFIG),
    /UNSAFE_RUN_URL/,
  );
});

test('CONSERVATIVE_CANCEL refuses every ambiguous identity and allows only one exact match', async () => {
  const makeEnv = () => envFor({
    GITHUB_TOKEN: 'github-secret',
    GITHUB_REPOSITORY: 'owner/repo',
    GITHUB_DISPATCH_WORKFLOW: 'dispatch.yml',
    GITHUB_DISPATCH_REF: 'execution',
    WATCHDOG_AGENTS: 'alpha',
    WATCHDOG_ENABLE_HUNG_CANCEL: '1',
    WATCHDOG_AUTO_DISPATCH: '0',
  });

  const scenarios = [
    { name: 'missing-run-id', heartbeat: { workflow: 'dispatch.yml', runUrl: undefined, runId: undefined }, response: null, expect: 0, cancel: false },
    { name: 'missing-run-url', heartbeat: { workflow: 'dispatch.yml', runId: 42, runUrl: undefined }, response: null, expect: 0, cancel: false },
    { name: 'workflow-mismatch', heartbeat: { workflow: 'other.yml', runId: 42, runUrl: 'https://github.com/owner/repo/actions/runs/42' }, response: null, expect: 0, cancel: false },
    { name: 'repository-mismatch', heartbeat: { workflow: 'dispatch.yml', runId: 42, runUrl: 'https://github.com/owner/other/actions/runs/42' }, response: null, expect: 0, cancel: false },
    { name: 'run-id-mismatch', heartbeat: { workflow: 'dispatch.yml', runId: 42, runUrl: 'https://github.com/owner/repo/actions/runs/42' }, response: { id: 43, status: 'in_progress', path: '.github/workflows/dispatch.yml', repository: { full_name: 'owner/repo' } }, expect: 1, cancel: false },
    { name: 'status-mismatch', heartbeat: { workflow: 'dispatch.yml', runId: 42, runUrl: 'https://github.com/owner/repo/actions/runs/42' }, response: { id: 42, status: 'completed', path: '.github/workflows/dispatch.yml', repository: { full_name: 'owner/repo' } }, expect: 1, cancel: false },
    { name: 'repository-response-mismatch', heartbeat: { workflow: 'dispatch.yml', runId: 42, runUrl: 'https://github.com/owner/repo/actions/runs/42' }, response: { id: 42, status: 'in_progress', path: '.github/workflows/dispatch.yml', repository: { full_name: 'owner/other' } }, expect: 1, cancel: false },
    { name: 'identity-ambiguous', heartbeat: { workflow: 'dispatch.yml', runId: 42, runUrl: 'https://github.com/owner/repo/actions/runs/42' }, response: { id: 42, status: 'in_progress', repository: { full_name: 'owner/repo' } }, expect: 1, cancel: false },
    { name: 'age-insufficient', heartbeat: { workflow: 'dispatch.yml', runId: 42, runUrl: 'https://github.com/owner/repo/actions/runs/42', young: true }, response: null, expect: 0, cancel: false },
    { name: 'exact-in-progress', heartbeat: { workflow: 'dispatch.yml', runId: 42, runUrl: 'https://github.com/owner/repo/actions/runs/42' }, response: { id: 42, status: 'in_progress', path: '.github/workflows/dispatch.yml', repository: { full_name: 'owner/repo' } }, expect: 2, cancel: true },
    { name: 'exact-waiting', heartbeat: { workflow: 'dispatch.yml', runId: 42, runUrl: 'https://github.com/owner/repo/actions/runs/42' }, response: { id: 42, status: 'waiting', path: '.github/workflows/dispatch.yml', repository: { full_name: 'owner/repo' } }, expect: 2, cancel: true },
  ];

  for (const scenario of scenarios) {
    const env = makeEnv();
    const state = new AgentState({ id: { name: 'alpha' }, storage: new MemoryStorage() });
        (env.AGENT_STATE as FakeNamespace).setState('alpha', state);

    const hb = scenario.heartbeat;
    const receivedAt = hb.young ? Date.now() - 1_000 : Date.now() - DEFAULT_CONFIG.cancelStaleRunningMs - 1_000;
    await state.recordHeartbeat({
      agentId: 'alpha',
      status: 'running',
      pending: 0,
      workflow: hb.workflow,
      ...(hb.runId === undefined ? {} : { runId: hb.runId }),
      ...(hb.runUrl === undefined ? {} : { runUrl: hb.runUrl }),
      receivedAt,
    }, DEFAULT_CONFIG.maxConsecutiveFails);

    const calls: string[] = [];
    const metrics = await (async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (input: URL | RequestInfo) => {
        calls.push(String(input));
        if (String(input).endsWith('/cancel')) return new Response('', { status: 202 });
        return new Response(JSON.stringify(scenario.response), { status: 200, headers: { 'content-type': 'application/json' } });
      };
      try {
        const metrics = new Metrics();
        await decide(env, metrics);
        return metrics.snapshot();
      } finally {
        globalThis.fetch = originalFetch;
      }
    })();

    assert.equal(calls.length, scenario.expect, scenario.name);
    assert.equal(calls.some((call) => call.endsWith('/cancel')), scenario.cancel, scenario.name);
    assert.equal((await state.getDispatchLog()).filter((entry) => entry.reason === 'cancellation').length, scenario.cancel ? 1 : 0, scenario.name);
    assert.equal(metrics.verify_pass, 1, scenario.name);
  }
});

test('CONSERVATIVE_CANCEL never dereferences the heartbeat run_url itself', async () => {
  const env = envFor({
    GITHUB_TOKEN: 'github-secret',
    GITHUB_REPOSITORY: 'owner/repo',
    GITHUB_DISPATCH_WORKFLOW: 'dispatch.yml',
    GITHUB_DISPATCH_REF: 'execution',
    WATCHDOG_ENABLE_HUNG_CANCEL: '1',
    WATCHDOG_AUTO_DISPATCH: '0',
  });
  const state = new AgentState({ id: { name: 'alpha' }, storage: new MemoryStorage() });
  (env.AGENT_STATE as FakeNamespace).setState('alpha', state);
  await state.recordHeartbeat({
    agentId: 'alpha',
    status: 'running',
    pending: 0,
    workflow: 'dispatch.yml',
    runId: 42,
    runUrl: 'https://github.com/owner/repo/actions/runs/42',
    receivedAt: Date.now() - DEFAULT_CONFIG.cancelStaleRunningMs - 1_000,
  }, DEFAULT_CONFIG.maxConsecutiveFails);

  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: URL | RequestInfo) => {
    calls.push(String(input));
    if (String(input).endsWith('/cancel')) return new Response('', { status: 202 });
    return new Response(JSON.stringify({
      id: 42,
      status: 'in_progress',
      path: '.github/workflows/dispatch.yml',
      repository: { full_name: 'owner/repo' },
    }), { status: 200 });
  };
  try {
    await decide(env, new Metrics());
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(calls, [
    'https://api.github.com/repos/owner/repo/actions/runs/42',
    'https://api.github.com/repos/owner/repo/actions/runs/42/cancel',
  ]);
});

test('NO_SECRET_LOGGING and FIXED_METRICS never expose secrets or admit dynamic metric keys', async () => {
  const env = baseEnv({ GITHUB_TOKEN: 'github-secret' });
  const config = {
    repository: 'owner/repo',
    workflow: 'dispatch.yml',
    ref: 'execution',
    apiVersion: '2026-03-10',
    autoDispatch: false,
    enableCancel: true,
    allowedWorkflows: ['dispatch.yml'],
    githubTimeoutMs: 5000,
    maxResponseBytes: 16 * 1024,
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('github-secret', { status: 500 });
  try {
    await assert.rejects(
      new GitHubClient(env, config).run(42),
      (error: unknown) => error instanceof Error && error.message === 'GITHUB_HTTP_500' && !error.message.includes('github-secret'),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  const metrics = new Metrics();
  metrics.inc('AGENT_TOKEN');
  metrics.inc('Authorization');
  metrics.inc('agent_id=alpha');
  assert.deepEqual(Object.keys(metrics.snapshot()), [
    'auth_denied',
    'heartbeat_invalid',
    'rate_limit_hit',
    'hb_running',
    'hb_completed',
    'hb_failed',
    'dispatch_ok',
    'dispatch_fail',
    'verify_pass',
    'verify_fail',
    'breaker_trip',
    'limit_hit',
  ]);
  assert.doesNotMatch(JSON.stringify(metrics.snapshot()), /agent-secret|old-secret|admin-secret|github-secret|Authorization/);
});

test('STRICT_LIB_CONTRACTS: lib source has no unchecked any and no unbounded response.json()', () => {
  for (const path of ['watchdog/src/lib/config.ts', 'watchdog/src/lib/runtime.ts', 'watchdog/src/lib/types.ts']) {
    const source = readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\bas any\b/u, path);
    assert.doesNotMatch(source, /response\.json\(\)/u, path);
  }
});
