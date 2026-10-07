import { createHash } from 'node:crypto';

type RateLimitResponse = {
  allowed: boolean;
  attempts: number;
  resetAt: string;
};

const config = () => {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/u, '');
  const secretKey = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !secretKey) return null;
  return { url, secretKey };
};

const bucketKeyForIp = (ip: string) =>
  'v1:' + createHash('sha256').update(ip.trim() || 'unknown', 'utf8').digest('hex');

const callRpc = async (path: string, body: Record<string, unknown>) => {
  const value = config();
  if (!value) throw new Error('admin_login_rate_limit_store_not_configured');
  const response = await fetch(`${value.url}${path}`, {
    method: 'POST',
    headers: {
      apikey: value.secretKey,
      Authorization: `Bearer ${value.secretKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let parsed: unknown = null;
  if (raw) {
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  }
  if (!response.ok) throw new Error(`admin_login_rate_limit_request_failed:http_${response.status}`);
  return parsed;
};

const assertDecision = (value: unknown): RateLimitResponse => {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as Record<string, unknown>).allowed !== 'boolean' ||
    !Number.isInteger((value as Record<string, unknown>).attempts) ||
    typeof (value as Record<string, unknown>).resetAt !== 'string'
  ) {
    throw new Error('admin_login_rate_limit_invalid_response');
  }
  return value as RateLimitResponse;
};

export const consumeAdminLoginRateLimit = async (
  ip: string,
  limit = 10,
  windowSeconds = 60,
): Promise<RateLimitResponse> => {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('admin_login_rate_limit_invalid_limit');
  }
  if (!Number.isInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 3600) {
    throw new Error('admin_login_rate_limit_invalid_window');
  }
  const decision = await callRpc('/rest/v1/rpc/flix_admin_login_rate_limit_consume', {
    p_bucket_key: bucketKeyForIp(ip),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  return assertDecision(decision);
};

export const resetAdminLoginRateLimit = async (ip: string): Promise<void> => {
  await callRpc('/rest/v1/rpc/flix_admin_login_rate_limit_reset', {
    p_bucket_key: bucketKeyForIp(ip),
  });
};
