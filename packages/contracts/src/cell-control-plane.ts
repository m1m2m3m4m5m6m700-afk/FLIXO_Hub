export const CELL_CONTRACT_VERSION = "1.1.0" as const;

export const TASK_STATES = [
  "PLANNED","READY","CLAIMED","RUNNING","CHECKPOINTED","VERIFYING","VERIFIED","PROMOTABLE","PROMOTED","FAILED","BLOCKED","ABANDONED",
] as const;
export type TaskState = (typeof TASK_STATES)[number];

export const AGENT_STATES = [
  "BOOTING","READY","WORKING","IDLE","STUCK","INTERRUPTED","FAILED","LOST","RECOVERING",
] as const;
export type AgentState = (typeof AGENT_STATES)[number];

export const CANDIDATE_STATES = [
  "CREATED","PROMISING","NEEDS_EVIDENCE","SELECTED","MODIFIED","REJECTED","SUPERSEDED","CERTIFIED","PROMOTED","ARCHIVED",
] as const;
export type CandidateState = (typeof CANDIDATE_STATES)[number];

const TASK_TRANSITIONS: Readonly<Record<TaskState, readonly TaskState[]>> = {
  PLANNED: ["READY","BLOCKED","ABANDONED"],
  READY: ["CLAIMED","BLOCKED","ABANDONED"],
  CLAIMED: ["RUNNING","FAILED","BLOCKED"],
  RUNNING: ["CHECKPOINTED","VERIFYING","FAILED","BLOCKED"],
  CHECKPOINTED: ["RUNNING","VERIFYING","FAILED","BLOCKED"],
  VERIFYING: ["VERIFIED","FAILED","BLOCKED"],
  VERIFIED: ["PROMOTABLE","FAILED"],
  PROMOTABLE: ["PROMOTED","FAILED"],
  PROMOTED: [],
  FAILED: ["READY","BLOCKED","ABANDONED"],
  BLOCKED: ["READY","ABANDONED"],
  ABANDONED: [],
};

const AGENT_TRANSITIONS: Readonly<Record<AgentState, readonly AgentState[]>> = {
  BOOTING: ["READY","FAILED"],
  READY: ["WORKING","IDLE","FAILED"],
  WORKING: ["IDLE","STUCK","INTERRUPTED","FAILED","LOST"],
  IDLE: ["WORKING","FAILED","LOST"],
  STUCK: ["WORKING","INTERRUPTED","FAILED","LOST","RECOVERING"],
  INTERRUPTED: ["RECOVERING","READY","FAILED"],
  FAILED: ["RECOVERING","READY"],
  LOST: ["RECOVERING"],
  RECOVERING: ["READY","WORKING","FAILED"],
};

const CANDIDATE_TRANSITIONS: Readonly<Record<CandidateState, readonly CandidateState[]>> = {
  CREATED: ["PROMISING","NEEDS_EVIDENCE","REJECTED"],
  PROMISING: ["SELECTED","NEEDS_EVIDENCE","REJECTED","SUPERSEDED"],
  NEEDS_EVIDENCE: ["SELECTED","REJECTED","SUPERSEDED"],
  SELECTED: ["MODIFIED","CERTIFIED","NEEDS_EVIDENCE","REJECTED","SUPERSEDED"],
  MODIFIED: ["NEEDS_EVIDENCE","SELECTED","REJECTED","SUPERSEDED"],
  REJECTED: ["ARCHIVED"],
  SUPERSEDED: ["ARCHIVED"],
  CERTIFIED: ["PROMOTED","SUPERSEDED"],
  PROMOTED: ["ARCHIVED"],
  ARCHIVED: [],
};

export type CellEntity = "TASK" | "AGENT" | "CANDIDATE";

export function canTransition(entity: CellEntity, from: string, to: string): boolean {
  const table = entity === "TASK" ? TASK_TRANSITIONS : entity === "AGENT" ? AGENT_TRANSITIONS : CANDIDATE_TRANSITIONS;
  const next = table[from as keyof typeof table];
  return Array.isArray(next) && (next as readonly string[]).includes(to);
}

export function assertTransition(entity: CellEntity, from: string, to: string): void {
  if (!canTransition(entity, from, to)) {
    throw new Error("INVALID_" + entity + "_TRANSITION:" + from + "->" + to);
  }
}

export type Lease = Readonly<{
  ownerId: string;
  token: string;
  acquiredAtMs: number;
  expiresAtMs: number;
}>;

export function isLeaseLive(lease: Lease, nowMs: number): boolean {
  return Boolean(
    lease.ownerId &&
      lease.token &&
      Number.isFinite(lease.acquiredAtMs) &&
      Number.isFinite(lease.expiresAtMs) &&
      lease.expiresAtMs > lease.acquiredAtMs &&
      nowMs >= lease.acquiredAtMs &&
      nowMs < lease.expiresAtMs,
  );
}

export function assertLeaseOwner(lease: Lease, ownerId: string, token: string, nowMs: number): void {
  if (!isLeaseLive(lease, nowMs) || lease.ownerId !== ownerId || lease.token !== token) {
    throw new Error("STALE_OR_INVALID_LEASE");
  }
}

export type RetryDecision = Readonly<{
  allowed: boolean;
  reason: "RETRYABLE" | "RETRY_BUDGET_EXHAUSTED" | "NON_RETRYABLE" | "MISSING_FAILURE_CLASSIFICATION" | "SAME_FAILURE";
}>;

export function decideRetry(input: Readonly<{
  attempts: number;
  maxAttempts: number;
  retryable: boolean | null;
  failureFingerprint: string | null;
  previousFailureFingerprint: string | null;
  sameCapability?: boolean;
  sameParameters?: boolean;
  replanned?: boolean;
}>): RetryDecision {
  if (input.attempts >= Math.min(3, input.maxAttempts)) return { allowed: false, reason: "RETRY_BUDGET_EXHAUSTED" };
  if (input.sameCapability === false || input.sameParameters === false || input.replanned === true) return { allowed: false, reason: "RETRY_REPLAN_FORBIDDEN" };
  if (input.retryable === null || !input.failureFingerprint) return { allowed: false, reason: "MISSING_FAILURE_CLASSIFICATION" };
  if (input.previousFailureFingerprint && input.failureFingerprint === input.previousFailureFingerprint) return { allowed: false, reason: "SAME_FAILURE" };
  if (!input.retryable) return { allowed: false, reason: "NON_RETRYABLE" };
  return { allowed: true, reason: "RETRYABLE" };
}

export type EvidenceRecord = Readonly<{
  testedSha: string;
  runtimeSha: string;
  sourceSha: string;
  createdAtMs: number;
  status: "CURRENT" | "STALE" | "REVOKED";
}>;

export function isEvidenceCurrent(evidence: EvidenceRecord, currentRuntimeSha: string): boolean {
  return Boolean(
    evidence.status === "CURRENT" &&
      evidence.testedSha === evidence.runtimeSha &&
      evidence.runtimeSha === evidence.sourceSha &&
      evidence.runtimeSha === currentRuntimeSha,
  );
}

export function classifyEvidence(evidence: EvidenceRecord, currentRuntimeSha: string): "CURRENT" | "STALE" | "REVOKED" {
  if (evidence.status === "REVOKED") return "REVOKED";
  return isEvidenceCurrent(evidence, currentRuntimeSha) ? "CURRENT" : "STALE";
}

export type PromotionGate = Readonly<{
  candidateState: CandidateState;
  testedSha: string;
  runtimeSha: string;
  certifiedSha: string | null;
  redTeam: "PASS" | "FAIL";
  opponent: "PASS" | "FAIL";
  certification: "PASS" | "FAIL";
}>;

export function canPromote(gate: PromotionGate, currentRuntimeSha: string): boolean {
  return Boolean(
    gate.candidateState === "CERTIFIED" &&
      gate.redTeam === "PASS" &&
      gate.opponent === "PASS" &&
      gate.certification === "PASS" &&
      gate.certifiedSha &&
      gate.testedSha === gate.runtimeSha &&
      gate.runtimeSha === gate.certifiedSha &&
      gate.certifiedSha === currentRuntimeSha,
  );
}

export type MemoryRecord = Readonly<{
  id: string;
  sourceSha: string;
  status: "CANDIDATE" | "PROMOTED" | "STALE_EVIDENCE" | "REVOKED";
  usable: boolean;
  confidence: number;
  provenance: readonly string[];
  updatedAtMs: number;
}>;

export function isMemoryActionable(memory: MemoryRecord, currentRuntimeSha: string): boolean {
  return Boolean(
    memory.id &&
      memory.status === "PROMOTED" &&
      memory.usable &&
      memory.sourceSha === currentRuntimeSha &&
      memory.provenance.length > 0 &&
      Number.isFinite(memory.confidence) &&
      memory.confidence >= 0 &&
      memory.confidence <= 100,
  );
}

export type WakeDecision = "WAKE" | "OBSERVE";

export function guardianDecision(input: Readonly<{
  agentState: AgentState;
  nowMs: number;
  lastSeenMs: number;
  heartbeatTimeoutMs: number;
}>): WakeDecision {
  const stale = input.nowMs - input.lastSeenMs >= input.heartbeatTimeoutMs;
  if (stale && ["WORKING","STUCK","INTERRUPTED"].includes(input.agentState)) return "WAKE";
  if (input.agentState === "LOST") return "WAKE";
  return "OBSERVE";
}

export type FrontierInput = Readonly<{
  expectedImprovement: number;
  probabilityOfSuccess: number;
  informationGain: number;
  cost: number;
  risk: number;
  evidenceBurden: number;
  reversibility: number;
}>;

export function scoreFrontier(input: FrontierInput): number {
  const bounded = (value: number) => Math.max(0, Math.min(1, value));
  const benefit = bounded(input.expectedImprovement) * bounded(input.probabilityOfSuccess) + bounded(input.informationGain) * 0.5;
  const penalty = bounded(input.cost) * 0.25 + bounded(input.risk) * 0.2 + bounded(input.evidenceBurden) * 0.2;
  const reversibleBonus = bounded(input.reversibility) * 0.1;
  return Number((benefit - penalty + reversibleBonus).toFixed(6));
}
