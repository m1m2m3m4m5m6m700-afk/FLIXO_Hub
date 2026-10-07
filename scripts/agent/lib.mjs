import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const AGENT_ID = sanitizeText(process.env.AGENT_ID || `repair-agent-${process.pid}`, 128) || `repair-agent-${process.pid}`;
export const WATCHDOG_URL = sanitizeUrl(process.env.WATCHDOG_URL || '');
export const AGENT_TOKEN = process.env.AGENT_TOKEN || '';
export const DEFAULT_TIMEOUT_MS = envInt('AGENT_TIMEOUT_MS', 30_000, 1_000, 15 * 60_000);
export const DEFAULT_OUTPUT_LIMIT = envInt('AGENT_MAX_OUTPUT_CHARS', 512_000, 4_096, 5_000_000);

export class BudgetExceededError extends Error {
  constructor(max, used, requested) {
    super(`AGENT_BUDGET_EXHAUSTED: max=${max} used=${used} requested=${requested}`);
    this.name = 'BudgetExceededError';
    this.code = 'AGENT_BUDGET_EXHAUSTED';
    this.max = max;
    this.used = used;
    this.requested = requested;
  }
}

export class StaleCheckpointError extends Error {
  constructor(expected, actual) {
    super(`STALE_CHECKPOINT: expected seq ${expected}, found ${actual}`);
    this.name = 'StaleCheckpointError';
    this.code = 'STALE_CHECKPOINT';
    this.expected = expected;
    this.actual = actual;
  }
}

export function envInt(name, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function sanitizeText(value, max = 2_048) {
  if (value == null) return '';
  return String(value).replace(/[\u0000-\u001f\u007f]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, max);
}

export function sanitizeUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return '';
  }
}

export function log(level, event, details = {}) {
  const safe = sanitizeLog(details);
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    agent_id: AGENT_ID,
    level,
    event,
    ...safe,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function sanitizeLog(value, seen = new WeakSet()) {
  if (typeof value === 'string') return sanitizeText(value, 1_024);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeLog(item, seen));
  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    const out = {};
    for (const [key, item] of Object.entries(value).slice(0, 40)) {
      if (/token|secret|authorization|api[_-]?key|password/iu.test(key)) out[key] = '[redacted]';
      else out[key] = sanitizeLog(item, seen);
    }
    return out;
  }
  return String(value);
}

export function sleep(ms, signal) {
  const duration = Math.max(0, Number(ms) || 0);
  return new Promise((resolvePromise, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('Aborted'));
      return;
    }
    let settled = false;
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    const resolveOnce = () => { if (settled) return; settled = true; cleanup(); resolvePromise(); };
    const rejectOnce = (error) => { if (settled) return; settled = true; clearTimeout(timer); cleanup(); reject(error); };
    const timer = setTimeout(resolveOnce, duration);
    const onAbort = () => rejectOnce(signal.reason ?? new Error('Aborted'));
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function withRetry(operation, {
  retries = 3,
  baseDelayMs = 250,
  factor = 2,
  maxDelayMs = 4_000,
  shouldRetry = () => true,
  signal,
  onRetry,
} = {}) {
  const attempts = Math.max(1, Number(retries) + 1);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation({ attempt, signal });
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetry(error, attempt)) throw error;
      const delay = Math.min(maxDelayMs, baseDelayMs * (factor ** (attempt - 1)));
      await onRetry?.(error, attempt, delay);
      await sleep(delay, signal);
    }
  }
  throw lastError;
}

export async function worker(task, { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  return withTimeout((innerSignal) => task(innerSignal), timeoutMs, 'worker timeout', signal);
}

export async function withTimeout(operation, timeoutMs, message = 'operation timeout', parentSignal) {
  const duration = Math.max(1, Number(timeoutMs) || 1);
  const controller = new AbortController();
  const relayAbort = () => controller.abort(parentSignal.reason ?? new Error('Aborted'));
  if (parentSignal?.aborted) relayAbort();
  else parentSignal?.addEventListener('abort', relayAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error(message)), duration);
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          const error = controller.signal.reason instanceof Error ? controller.signal.reason : new Error(message);
          error.code ??= 'TIMEOUT';
          reject(error);
        }, { once: true });
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (parentSignal) parentSignal.removeEventListener('abort', relayAbort);
  }
}

export async function loadCheckpoint(filePath, fallback = {}) {
  const resolved = resolve(filePath);
  try {
    const stat = await lstat(resolved);
    if (!stat.isFile()) throw new Error('CHECKPOINT_NOT_REGULAR_FILE');
    if (stat.size > 1_000_000) throw new Error('CHECKPOINT_TOO_LARGE');
    const text = await readFile(resolved, 'utf8');
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('CHECKPOINT_INVALID');
    return { ...fallback, ...value };
  } catch (error) {
    if (error?.code === 'ENOENT') return { ...fallback, __seq: 0, __ts: null };
    throw error;
  }
}

export async function saveCheckpoint(filePath, state, { expectedSeq = null } = {}) {
  const resolved = resolve(filePath);
  const current = await loadCheckpoint(resolved, {});
  const currentSeq = Number.isInteger(current.__seq) && current.__seq >= 0 ? current.__seq : 0;
  // __seq is a client-side stale-writer guard; it does not make KV/file mutation
  // linearizable by itself. Concurrent authoritative serialization belongs server-side/DO.
  if (expectedSeq !== null && currentSeq !== Number(expectedSeq)) {
    throw new StaleCheckpointError(expectedSeq, currentSeq);
  }
  const requestedSeq = Number.isInteger(state?.__seq) ? state.__seq : null;
  const proposedSeq = requestedSeq !== null && requestedSeq > currentSeq ? requestedSeq : currentSeq + 1;
  const next = {
    ...state,
    __seq: proposedSeq,
    __ts: new Date().toISOString(),
  };
  const dir = dirname(resolved);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const temp = `${resolved}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
  await rename(temp, resolved);
  return next;
}

export async function heartbeat({
  watchdogUrl = WATCHDOG_URL,
  agentToken = AGENT_TOKEN,
  run_url = '',
  seq = 0,
  task_id = '',
  last_checkpoint = '',
  pending = false,
  status = 'running',
  timeoutMs = 5_000,
  fetchImpl = fetch,
} = {}) {
  if (!watchdogUrl) {
    log('warn', 'heartbeat_unconfigured', { run_url, seq, task_id, last_checkpoint, pending, status });
    return false;
  }
  const controllerPayload = {
    agent_id: AGENT_ID,
    run_url: sanitizeUrl(run_url) || undefined,
    seq: Number.isFinite(Number(seq)) ? Number(seq) : 0,
    task_id: sanitizeText(task_id, 256) || undefined,
    last_checkpoint: sanitizeText(last_checkpoint, 512) || undefined,
    pending: Boolean(pending),
    status: sanitizeText(status, 64) || 'running',
  };
  try {
    await withTimeout(async (signal) => {
      const response = await fetchImpl(watchdogUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...(agentToken ? { authorization: `Bearer ${agentToken}` } : {}),
        },
        body: JSON.stringify(controllerPayload),
        signal,
      });
      if (!response.ok) throw new Error(`WATCHDOG_${response.status}`);
    }, timeoutMs, 'heartbeat timeout');
    return true;
  } catch (error) {
    log('warn', 'heartbeat_failed', { reason: error?.message || String(error), seq, task_id, status });
    return false;
  }
}

export class Budget {
  constructor(max = envInt('AGENT_MAX_BUDGET', 100, 0, 1_000_000)) {
    if (!Number.isFinite(Number(max)) || Number(max) < 0) throw new TypeError('Budget max must be non-negative');
    this.max = Number(max);
    this.used = 0;
    this.reserved = 0;
  }

  reserve(requested) {
    const amount = this.#amount(requested);
    if (this.used + this.reserved + amount > this.max) {
      throw new BudgetExceededError(this.max, this.used + this.reserved, amount);
    }
    this.reserved += amount;
    return amount;
  }

  refund(requested) {
    const amount = this.#amount(requested);
    if (amount > this.reserved) throw new RangeError('Cannot refund more than reserved budget');
    this.reserved -= amount;
    return this.remaining;
  }

  spend(requested) {
    const amount = this.#amount(requested);
    if (this.reserved >= amount) {
      this.reserved -= amount;
      this.used += amount;
      return this.used;
    }
    if (this.used + this.reserved + amount > this.max) {
      throw new BudgetExceededError(this.max, this.used + this.reserved, amount);
    }
    this.used += amount;
    return this.used;
  }

  get remaining() {
    return this.max - this.used - this.reserved;
  }

  get exhausted() {
    return this.remaining <= 0;
  }

  #amount(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) throw new TypeError('Budget amount must be a finite non-negative number');
    return amount;
  }
}

export function deterministicIdentity(repository, issueNumber) {
  const canonicalRepo = canonicalRepository(repository);
  const number = Number(issueNumber);
  if (!canonicalRepo || !Number.isInteger(number) || number <= 0) throw new TypeError('Invalid task identity input');
  return `issue:${createHash('sha256').update(`${canonicalRepo}#${number}`).digest('hex').slice(0, 32)}`;
}

export function canonicalRepository(value) {
  const repo = sanitizeText(value, 200).replace(/^https?:\/\/github\.com\//iu, '').replace(/\.git$/iu, '');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repo)) return '';
  return repo;
}
