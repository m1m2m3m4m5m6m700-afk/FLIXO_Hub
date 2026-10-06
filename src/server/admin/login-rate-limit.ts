import { createHash } from 'node:crypto';

export type AdminLoginRateLimitResult = {
  allowed: boolean;
  attempts: number;
  retryAfterSeconds: number;
};

const LIMIT = 10;
const MAX_STORED_KEYS = 50_000;
const HASH_PATTERN = /^[0-9a-f]{64}$/i;

const config = () => {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const serviceKey = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  const salt = (process.env.ADMIN_RATE_LIMIT_SALT ?? process.env.ADMIN_SESSION_SECRET)?.trim();
  if (!url || !serviceKey || !salt) return null;
  return { url, serviceKey, salt };
};

export const hashRateLimitKey = (rawKey: string, salt: string): string => {
  const normalized = rawKey.trim() || 'unknown';
  return createHash('sha256')
    .update('flixo-admin-login-v1:', 'utf8')
    .update(salt, 'utf8')
    .update(':', 'utf8')
    .update(normalized, 'utf8')
    .digest('hex');
};

const assertLimiterResponse = (body: unknown): AdminLoginRateLimitResult => {
  if (!Array.isArray(body) || body.length !== 1 || typeof body[0] !== 'object' || body[0] === null) {
    throw new Error('admin_login_rate_limiter_malformed_response');
  }
  const row = body[0] as Record<string, unknown>;
  const allowed = row.allowed;
  const attempts = Number(row.attempts);
  const retryAfterSeconds = Number(row.retry_after_seconds);
  if (
    typeof allowed !== 'boolean'
    || !Number.isInteger(attempts)
    || attempts < 1
    || attempts > LIMIT + 1
    || !Number.isInteger(retryAfterSeconds)
    || retryAfterSeconds < 0
    || retryAfterSeconds > 60
  ) {
    throw new Error('admin_login_rate_limiter_malformed_response');
  }
  return { allowed, attempts, retryAfterSeconds };
};

export const consumeAdminLoginAttempt = async (rawKey: string): Promise<AdminLoginRateLimitResult> => {
  const value = config();
  if (!value) throw new Error('admin_login_rate_limiter_not_configured');

  const keyHash = hashRateLimitKey(rawKey, value.salt);
  if (!HASH_PATTERN.test(keyHash)) throw new Error('admin_login_rate_limiter_hash_invalid');

  let response: Response;
  try {
    response = await fetch(value.url + '/rest/v1/rpc/flixo_admin_login_rate_check', {
      method: 'POST',
      headers: {
        apikey: value.serviceKey,
        Authorization: 'Bearer ' + value.serviceKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_key_hash: keyHash }),
    });
  } catch {
    throw new Error('admin_login_rate_limiter_unavailable');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('admin_login_rate_limiter_malformed_response');
  }
  if (!response.ok) throw new Error('admin_login_rate_limiter_unavailable');

  return assertLimiterResponse(body);
};

export const adminLoginRateLimitContract = {
  limit: LIMIT,
  maxStoredKeys: MAX_STORED_KEYS,
  storageTable: 'public.flix_admin_login_rate_limits',
  rpc: 'public.flixo_admin_login_rate_check',
} as const;
