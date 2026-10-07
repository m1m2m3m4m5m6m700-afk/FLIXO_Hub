import { readJson } from './lib/runtime.ts';
import { CORE_LIMITS } from './lib/config.ts';
import type {
  AgentStateRecord,
  CheckpointRecord,
  DispatchRecord,
  DispatchReservation,
  DurableObjectStateLike,
  FailureState,
  HeartbeatRecord,
  RateBucket,
  RateResult,
  ReserveResult,
} from './lib/types.ts';

const bytes = (value: string) => new TextEncoder().encode(value).byteLength;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const fail = (code: string): never => { throw new Error(code); };

const isStatus = (value: unknown): value is HeartbeatRecord['status'] =>
  value === 'running' || value === 'completed' || value === 'failed' || value === 'pending';
const isResult = (value: unknown): value is DispatchRecord['result'] =>
  value === 'reserved' || value === 'ok' || value === 'fail' || value === 'cancelled';
const isReason = (value: unknown): value is DispatchRecord['reason'] =>
  value === 'stale-running' || value === 'failed' || value === 'pending-not-continued' || value === 'manual' || value === 'cancellation';
const isBucket = (value: unknown): value is RateBucket =>
  value === 'heartbeat' || value === 'mutation' || value === 'failsBump' || value === 'dlog' || value === 'forget';

export class AgentState {
  private readonly storage: DurableObjectStateLike['storage'];
  private readonly agentId: string;

  constructor(state: DurableObjectStateLike) {
    this.storage = state.storage;
    this.agentId = state.id.name ?? state.id.toString();
    if (!/^[A-Za-z0-9_.:-]+$/.test(this.agentId)) fail('INVALID_AGENT_ID');
  }

  private async tx<T>(fn: (storage: DurableObjectStateLike['storage']) => Promise<T>): Promise<T> {
    if (this.storage.transaction) return this.storage.transaction(fn);
    return fn(this.storage);
  }

  private async readState(): Promise<AgentStateRecord | null> {
    const stored = await this.storage.get<unknown>('state:v1');
    if (stored === undefined || stored === null) return null;
    if (!isRecord(stored)) fail('CORRUPT_DO_STATE');
    const raw = stored as unknown as Record<string, unknown>;
    if (
      raw.agentId !== this.agentId
      || !Number.isSafeInteger(raw.checkpointSeq) || Number(raw.checkpointSeq) < 0
      || !Number.isSafeInteger(raw.consecutiveFails) || Number(raw.consecutiveFails) < 0
      || Number(raw.consecutiveFails) > CORE_LIMITS.maxConsecutiveFails
      || typeof raw.breakerTripped !== 'boolean'
      || !Array.isArray(raw.dispatches)
      || !Number.isSafeInteger(raw.updatedAt) || Number(raw.updatedAt) <= 0
      || (raw.checkpoint !== undefined && (typeof raw.checkpoint !== 'string' || bytes(raw.checkpoint) > CORE_LIMITS.maxCheckpointBytes))) {
      fail('CORRUPT_DO_STATE');
    }
    const dispatches = raw.dispatches as unknown[];
    if (dispatches.length > CORE_LIMITS.maxDispatchLogEntries) fail('CORRUPT_DO_LOG');
    for (const item of dispatches) this.assertDispatch(item);
    return raw as unknown as AgentStateRecord;
  }

  private assertDispatch(value: unknown): asserts value is DispatchRecord {
    if (!isRecord(value)
      || !Number.isSafeInteger(value.timestamp) || Number(value.timestamp) <= 0
      || value.agentId !== this.agentId
      || typeof value.workflow !== 'string' || bytes(value.workflow) > CORE_LIMITS.maxWorkflowBytes
      || !/^[A-Za-z0-9_./-]+$/.test(value.workflow) || value.workflow.includes('..') || value.workflow.startsWith('/') || value.workflow.endsWith('/')
      || (value.runIdentity !== undefined && (typeof value.runIdentity !== 'string' || bytes(value.runIdentity) > CORE_LIMITS.maxRunIdentityBytes || !/^[A-Za-z0-9_.:-]+$/.test(value.runIdentity)))
      || !isResult(value.result) || !isReason(value.reason)) {
      fail('CORRUPT_DO_LOG');
    }
  }

  private async writeState(state: AgentStateRecord): Promise<void> {
    await this.storage.put('state:v1', state);
  }

  private defaultState(now = Date.now()): AgentStateRecord {
    return {
      agentId: this.agentId,
      checkpointSeq: 0,
      consecutiveFails: 0,
      breakerTripped: false,
      dispatches: [],
      updatedAt: now,
    };
  }

  async setCheckpoint(seq: number, checkpoint: string): Promise<{ accepted: boolean }> {
    if (!Number.isSafeInteger(seq) || seq < 0) fail('INVALID_CHECKPOINT_SEQ');
    if (typeof checkpoint !== 'string' || bytes(checkpoint) > CORE_LIMITS.maxCheckpointBytes) fail('INVALID_CHECKPOINT');
    return this.tx(async () => {
      const current = (await this.readState()) ?? this.defaultState();
      if (seq <= current.checkpointSeq) return { accepted: false };
      current.checkpointSeq = seq;
      current.checkpoint = checkpoint;
      current.updatedAt = Date.now();
      await this.writeState(current);
      return { accepted: true };
    });
  }

  async getCheckpoint(): Promise<CheckpointRecord> {
    const state = await this.readState();
    return {
      checkpointSeq: state?.checkpointSeq ?? 0,
      ...(state?.checkpoint === undefined ? {} : { checkpoint: state.checkpoint }),
    };
  }

  async bumpFailure(maxConsecutiveFails: number): Promise<FailureState & { trippedNow: boolean }> {
    if (!Number.isSafeInteger(maxConsecutiveFails) || maxConsecutiveFails < 1 || maxConsecutiveFails > CORE_LIMITS.maxConsecutiveFails) fail('INVALID_FAILURE_LIMIT');
    return this.tx(async () => {
      const current = (await this.readState()) ?? this.defaultState();
      const before = current.breakerTripped;
      current.consecutiveFails = Math.min(maxConsecutiveFails, current.consecutiveFails + 1);
      if (current.consecutiveFails >= maxConsecutiveFails) current.breakerTripped = true;
      current.updatedAt = Date.now();
      await this.writeState(current);
      return {
        consecutiveFails: current.consecutiveFails,
        breakerTripped: current.breakerTripped,
        trippedNow: !before && current.breakerTripped,
      };
    });
  }

  async getFailureState(): Promise<FailureState> {
    const state = await this.readState();
    return {
      consecutiveFails: state?.consecutiveFails ?? 0,
      breakerTripped: state?.breakerTripped ?? false,
    };
  }

  async recordHeartbeat(heartbeat: HeartbeatRecord, failureLimit: number): Promise<FailureState> {
    this.assertHeartbeat(heartbeat);
    if (!Number.isSafeInteger(failureLimit) || failureLimit < 1 || failureLimit > CORE_LIMITS.maxConsecutiveFails) fail('INVALID_FAILURE_LIMIT');
    return this.tx(async () => {
      const current = (await this.readState()) ?? this.defaultState();
      await this.storage.put('heartbeat:v1', heartbeat);
      if (heartbeat.status === 'completed') current.consecutiveFails = 0;
      if (heartbeat.status === 'failed') current.consecutiveFails = Math.min(failureLimit, current.consecutiveFails + 1);
      if (current.consecutiveFails >= failureLimit && heartbeat.status === 'failed') current.breakerTripped = true;
      current.updatedAt = Date.now();
      await this.writeState(current);
      return { consecutiveFails: current.consecutiveFails, breakerTripped: current.breakerTripped };
    });
  }

  private assertHeartbeat(value: unknown): asserts value is HeartbeatRecord {
    if (!isRecord(value)
      || value.agentId !== this.agentId
      || !isStatus(value.status)
      || !Number.isSafeInteger(value.pending) || Number(value.pending) < 0
      || !Number.isSafeInteger(value.receivedAt) || Number(value.receivedAt) <= 0
      || (value.taskId !== undefined && (typeof value.taskId !== 'string' || bytes(value.taskId) > CORE_LIMITS.maxTaskIdBytes || !/^[A-Za-z0-9_.:-]+$/.test(value.taskId) || value.taskId.includes('..')))
      || (value.checkpoint !== undefined && (typeof value.checkpoint !== 'string' || bytes(value.checkpoint) > CORE_LIMITS.maxCheckpointBytes))
      || (value.workflow !== undefined && (typeof value.workflow !== 'string' || bytes(value.workflow) > CORE_LIMITS.maxWorkflowBytes || !/^[A-Za-z0-9_./-]+$/.test(value.workflow) || value.workflow.includes('..') || value.workflow.startsWith('/') || value.workflow.endsWith('/')))
      || (value.runId !== undefined && (!Number.isSafeInteger(value.runId) || Number(value.runId) <= 0))
      || (value.runUrl !== undefined && (typeof value.runUrl !== 'string' || bytes(value.runUrl) > CORE_LIMITS.maxRunUrlBytes))) {
      fail('CORRUPT_DO_HEARTBEAT');
    }
  }

  async resetFailure(): Promise<FailureState> {
    return this.tx(async () => {
      const current = (await this.readState()) ?? this.defaultState();
      current.consecutiveFails = 0;
      current.updatedAt = Date.now();
      await this.writeState(current);
      return { consecutiveFails: current.consecutiveFails, breakerTripped: current.breakerTripped };
    });
  }

  async resetBreaker(): Promise<FailureState> {
    return this.tx(async () => {
      const current = (await this.readState()) ?? this.defaultState();
      current.breakerTripped = false;
      current.updatedAt = Date.now();
      await this.writeState(current);
      return { consecutiveFails: current.consecutiveFails, breakerTripped: current.breakerTripped };
    });
  }

  async tripBreaker(): Promise<FailureState> {
    return this.tx(async () => {
      const current = (await this.readState()) ?? this.defaultState();
      current.breakerTripped = true;
      current.updatedAt = Date.now();
      await this.writeState(current);
      return { consecutiveFails: current.consecutiveFails, breakerTripped: current.breakerTripped };
    });
  }

  async reserveDispatch(record: DispatchReservation, at: number, maxPerHour: number, windowMs: number, minGapMinutes: number): Promise<ReserveResult> {
    if (!isRecord(record) || typeof record.agentId !== 'string' || typeof record.workflow !== 'string' || !isReason(record.reason) || (record.runIdentity !== undefined && typeof record.runIdentity !== 'string')) fail('INVALID_DISPATCH_RECORD');
    if (!Number.isSafeInteger(at) || at <= 0 || !Number.isSafeInteger(maxPerHour) || maxPerHour < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1 || !Number.isSafeInteger(minGapMinutes) || minGapMinutes < 0) fail('INVALID_DISPATCH_LIMIT');
    return this.tx(async () => {
      const current = (await this.readState()) ?? this.defaultState(at);
      if (current.breakerTripped) return { accepted: false, reason: 'breaker' };
      const active = current.dispatches.filter((entry) => entry.timestamp >= at - windowMs);
      if (active.length >= maxPerHour) return { accepted: false, reason: 'hourly-limit' };
      const latest = active.at(-1);
      if (latest && at - latest.timestamp < minGapMinutes * 60_000) return { accepted: false, reason: 'min-gap' };
      const reserved: DispatchRecord = { ...record, timestamp: at, result: 'reserved' };
      current.dispatches = [...current.dispatches, reserved];
      current.updatedAt = at;
      await this.writeState(current);
      return { accepted: true };
    });
  }

  async appendDispatch(record: DispatchRecord): Promise<void> {
    this.assertDispatch(record);
    return this.tx(async () => {
      const current = (await this.readState()) ?? this.defaultState(record.timestamp);
      if (current.dispatches.length >= CORE_LIMITS.maxDispatchLogEntries) fail('DISPATCH_LOG_FULL');
      current.dispatches = [...current.dispatches, record];
      current.updatedAt = record.timestamp;
      await this.writeState(current);
    });
  }

  async getDispatchLog(): Promise<DispatchRecord[]> {
    const state = await this.readState();
    return [...(state?.dispatches ?? [])];
  }

  private async readHeartbeat(): Promise<HeartbeatRecord | null> {
    const raw = await this.storage.get<unknown>('heartbeat:v1');
    if (raw === undefined) return null;
    this.assertHeartbeat(raw);
    return raw;
  }

  async getHeartbeat(): Promise<HeartbeatRecord | null> {
    return this.readHeartbeat();
  }

  async getSnapshot(): Promise<{ state: AgentStateRecord | null; heartbeat: HeartbeatRecord | null }> {
    await this.readState();
    const heartbeat = await this.readHeartbeat();
    return { state: await this.readState(), heartbeat };
  }

  async consumeRateLimit(bucket: RateBucket, fingerprint: string, at: number, windowMs: number, limit: number): Promise<RateResult> {
    if (!isBucket(bucket)
      || !/^[0-9a-f]{64}$/.test(fingerprint)
      || !Number.isSafeInteger(at) || at <= 0
      || !Number.isSafeInteger(windowMs) || windowMs < 1
      || !Number.isSafeInteger(limit) || limit < 1) fail('INVALID_RATE_REQUEST');
    return this.tx(async () => {
      const key = 'rate:v1:' + fingerprint + ':' + bucket;
      const raw = await this.storage.get<unknown>(key);
      let state: { bucket: RateBucket; windowStart: number; count: number } = { bucket, windowStart: at, count: 0 };
      if (raw !== undefined) {
        if (!isRecord(raw) || !isBucket(raw.bucket) || raw.bucket !== bucket
          || !Number.isSafeInteger(raw.windowStart) || Number(raw.windowStart) <= 0
          || !Number.isSafeInteger(raw.count) || Number(raw.count) < 0 || Number(raw.count) > limit * 1024) {
          fail('CORRUPT_RATE_STATE');
        }
        state = raw as typeof state;
        if (at >= state.windowStart + windowMs) state = { bucket, windowStart: at, count: 0 };
      }
      if (state.count >= limit) return { allowed: false, retryAt: state.windowStart + windowMs };
      state.count += 1;
      await this.storage.put(key, state);
      return { allowed: true, retryAt: state.windowStart + windowMs };
    });
  }

  async forget(): Promise<void> {
    await this.storage.deleteAll();
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const path = new URL(request.url).pathname.replace(/^\//, '');
      if (request.method === 'GET') {
        if (path === 'getSnapshot') return this.json(await this.getSnapshot());
        if (path === 'getCheckpoint') return this.json(await this.getCheckpoint());
        if (path === 'getHeartbeat') return this.json(await this.getHeartbeat());
        if (path === 'getFailureState') return this.json(await this.getFailureState());
        if (path === 'getDispatchLog') return this.json(await this.getDispatchLog());
      }
      if (request.method === 'POST') {
        const body = await readJson(request, CORE_LIMITS.maxRpcBodyBytes);
        if (path === 'setCheckpoint') return this.json(await this.setCheckpoint(Number(body.seq), String(body.checkpoint)));
        if (path === 'bumpFailure') return this.json(await this.bumpFailure(Number(body.maxConsecutiveFails)));
        if (path === 'resetFailure') return this.json(await this.resetFailure());
        if (path === 'resetBreaker') return this.json(await this.resetBreaker());
        if (path === 'tripBreaker') return this.json(await this.tripBreaker());
        if (path === 'forget') { await this.forget(); return this.json({ ok: true }); }
        if (path === 'recordHeartbeat') return this.json(await this.recordHeartbeat(body.heartbeat as HeartbeatRecord, Number(body.failureLimit)));
        if (path === 'appendDispatch') { this.assertDispatch(body.record); await this.appendDispatch(body.record); return this.json({ ok: true }); }
        if (path === 'reserveDispatch') {
          this.assertDispatch(body.record);
          return this.json(await this.reserveDispatch(body.record, Number(body.at), Number(body.maxPerHour), Number(body.windowMs), Number(body.minGap)));
        }
        if (path === 'consumeRateLimit') return this.json(await this.consumeRateLimit(body.bucket as RateBucket, String(body.fp), Number(body.at), Number(body.windowMs), Number(body.limit)));
      }
      return this.json({ error: 'NOT_FOUND' }, 404);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
      const status = /^CORRUPT_|^INVALID_|^UNSAFE_|^DO_/.test(code) ? 422 : code === 'NOT_FOUND' ? 404 : 500;
      return this.json({ error: code }, status);
    }
  }

  private json(value: unknown, status = 200): Response {
    return new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}
