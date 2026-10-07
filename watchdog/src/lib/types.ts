export type HeartbeatStatus = 'running' | 'completed' | 'failed' | 'pending';
export type DispatchResult = 'reserved' | 'ok' | 'fail' | 'cancelled';
export type DispatchReason = 'stale-running' | 'failed' | 'pending-not-continued' | 'manual' | 'cancellation';
export type RateBucket = 'heartbeat' | 'mutation' | 'failsBump' | 'dlog' | 'forget';

export interface HeartbeatRecord {
  agentId: string;
  status: HeartbeatStatus;
  pending: number;
  receivedAt: number;
  taskId?: string;
  checkpoint?: string;
  workflow?: string;
  runUrl?: string;
  runId?: number;
}

export interface DispatchRecord {
  timestamp: number;
  agentId: string;
  workflow: string;
  runIdentity?: string;
  result: DispatchResult;
  reason: DispatchReason;
}

export type AgentState = AgentStateRecord;

export interface AgentStateRecord {
  agentId: string;
  checkpointSeq: number;
  checkpoint?: string;
  consecutiveFails: number;
  breakerTripped: boolean;
  dispatches: DispatchRecord[];
  updatedAt: number;
}

export interface FailureState {
  consecutiveFails: number;
  breakerTripped: boolean;
}

export interface CheckpointRecord {
  checkpointSeq: number;
  checkpoint?: string;
}

export interface ReserveAccepted {
  accepted: true;
  reason?: undefined;
}

export interface ReserveRejected {
  accepted: false;
  reason: 'breaker' | 'hourly-limit' | 'min-gap';
}

export type ReserveResult = ReserveAccepted | ReserveRejected;

export interface RateResult {
  allowed: boolean;
  retryAt: number;
}

export interface RateConfig {
  windowMs: number;
  limit: number;
}

export interface Config {
  maxBodyBytes: number;
  maxResponseBytes: number;
  maxRpcBodyBytes: number;
  maxAgentIdBytes: number;
  maxTaskIdBytes: number;
  maxCheckpointBytes: number;
  maxWorkflowBytes: number;
  maxRunUrlBytes: number;
  maxRunIdBytes: number;
  maxRunIdentityBytes: number;
  maxReasonBytes: number;
  maxDispatchLogEntries: number;
  maxStatusAgents: number;
  maxAgents: number;
  maxConsecutiveFails: number;
  maxDispatchesPerHour: number;
  dispatchWindowMs: number;
  minGapMinutes: number;
  staleRunningMs: number;
  pendingNotContinuedMs: number;
  cancelStaleRunningMs: number;
  githubTimeoutMs: number;
  rate: Record<RateBucket, RateConfig>;
}

export interface DurableObjectStorageLike {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  deleteAll(): Promise<void>;
  transaction?<T>(callback: (tx: DurableObjectStorageLike) => Promise<T>): Promise<T>;
}

export interface DurableObjectIdLike {
  name?: string;
  toString(): string;
}

export interface DurableObjectStubLike {
  fetch(request: Request): Promise<Response>;
}

export interface DurableObjectNamespaceLike {
  idFromName(name: string): DurableObjectIdLike;
  get(id: DurableObjectIdLike): DurableObjectStubLike;
}

export interface DurableObjectStateLike {
  id: DurableObjectIdLike;
  storage: DurableObjectStorageLike;
}

export interface Env {
  AGENT_STATE: DurableObjectNamespaceLike;
  AGENT_TOKEN?: string;
  AGENT_TOKEN_PREV?: string;
  ADMIN_TOKEN?: string;
  GITHUB_TOKEN?: string;
  GITHUB_REPOSITORY?: string;
  GITHUB_DISPATCH_WORKFLOW?: string;
  GITHUB_DISPATCH_REF?: string;
  GITHUB_API_VERSION?: string;
  WATCHDOG_AGENTS?: string;
  WATCHDOG_AUTO_DISPATCH?: string;
  WATCHDOG_ENABLE_HUNG_CANCEL?: string;
}
