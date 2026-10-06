import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adminLoginRateLimitContract,
  consumeAdminLoginAttempt,
  hashRateLimitKey,
} from '../src/server/admin/login-rate-limit.ts';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

const reset = () => {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
};

test.afterEach(reset);

const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const configure = () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  process.env.ADMIN_RATE_LIMIT_SALT = 'long-test-salt-for-rate-limiter';
};

test('first distributed rate-limit attempt is allowed and only sends a salted hash', async () => {
  configure();
  const rawIp = '203.0.113.9';
  let requestBody: Record<string, unknown> | null = null;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    return response([{ allowed: true, attempts: 1, retry_after_seconds: 60 }]);
  };

  const result = await consumeAdminLoginAttempt(rawIp);
  assert.deepEqual(result, { allowed: true, attempts: 1, retryAfterSeconds: 60 });
  assert.equal(requestBody?.p_key_hash, hashRateLimitKey(rawIp, process.env.ADMIN_RATE_LIMIT_SALT!));
  assert.equal(String(requestBody?.p_key_hash).includes(rawIp), false);
  assert.match(String(requestBody?.p_key_hash), /^[0-9a-f]{64}$/);
});

test('threshold is enforced by shared responses: first ten allowed, eleventh denied', async () => {
  configure();
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    return response([{
      allowed: attempts <= 10,
      attempts: Math.min(attempts, 11),
      retry_after_seconds: attempts <= 10 ? 60 : 30,
    }]);
  };

  const results = [];
  for (let i = 0; i < 11; i += 1) results.push(await consumeAdminLoginAttempt('198.51.100.7'));
  assert.equal(results.filter((item) => item.allowed).length, 10);
  assert.equal(results[10].allowed, false);
  assert.equal(results[10].attempts, 11);
});

test('window reset is accepted from the shared limiter after a new window', async () => {
  configure();
  let window = 1;
  globalThis.fetch = async () => {
    if (window === 1) return response([{ allowed: false, attempts: 11, retry_after_seconds: 5 }]);
    return response([{ allowed: true, attempts: 1, retry_after_seconds: 60 }]);
  };

  const first = await consumeAdminLoginAttempt('192.0.2.1');
  assert.equal(first.allowed, false);
  window = 2;
  const second = await consumeAdminLoginAttempt('192.0.2.1');
  assert.equal(second.allowed, true);
  assert.equal(second.attempts, 1);
});

test('concurrent callers use the same shared key and preserve atomic-style threshold semantics', async () => {
  configure();
  let attempts = 0;
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    assert.equal(body.p_key_hash, hashRateLimitKey('198.51.100.8', process.env.ADMIN_RATE_LIMIT_SALT!));
    attempts += 1;
    const count = attempts;
    return response([{ allowed: count <= 10, attempts: Math.min(count, 11), retry_after_seconds: count <= 10 ? 60 : 45 }]);
  };

  const results = await Promise.all(Array.from({ length: 20 }, () => consumeAdminLoginAttempt('198.51.100.8')));
  assert.equal(attempts, 20);
  assert.equal(results.filter((item) => item.allowed).length, 10);
  assert.equal(results.filter((item) => !item.allowed).length, 10);
});

test('limiter outage fails closed', async () => {
  configure();
  globalThis.fetch = async () => { throw new Error('network down'); };
  await assert.rejects(() => consumeAdminLoginAttempt('203.0.113.10'), /admin_login_rate_limiter_unavailable/);
});

test('malformed limiter response fails closed', async () => {
  configure();
  globalThis.fetch = async () => response([{ allowed: 'yes', attempts: 1, retry_after_seconds: 60 }]);
  await assert.rejects(() => consumeAdminLoginAttempt('203.0.113.11'), /admin_login_rate_limiter_malformed_response/);
});

test('contract remains bounded and server-side', () => {
  assert.equal(adminLoginRateLimitContract.limit, 10);
  assert.equal(adminLoginRateLimitContract.maxStoredKeys, 50_000);
  assert.equal(adminLoginRateLimitContract.storageTable, 'public.flix_admin_login_rate_limits');
  assert.equal(adminLoginRateLimitContract.rpc, 'public.flixo_admin_login_rate_check');
});
