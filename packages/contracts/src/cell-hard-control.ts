import type { AgentState } from "./cell-control-plane";

export const HARD_CONTROL_CONTRACT_VERSION = "1.1.0" as const;

export const CELL_AUTHORITY_RANK = Object.freeze({
  SCOUT: 10,
  ANALYST: 20,
  IMPLEMENTER: 30,
  INTEGRATOR: 40,
  CERTIFIER: 50,
  ROOT: 100,
} as const);

export type CellAuthority = keyof typeof CELL_AUTHORITY_RANK;

export const CELL_PROTECTED_PATHS = Object.freeze([
  "packages/contracts/src/cell-**",
  "scripts/agent-control-plane.mjs",
  "scripts/ci/cell-**",
  "الخلية.md",
] as const);

export function authorityRank(authority: CellAuthority | undefined): number {
  return authority ? CELL_AUTHORITY_RANK[authority] : 0;
}

export type DriftType =
  | "D1_SCOPE_DRIFT"
  | "D2_OBJECTIVE_DRIFT"
  | "D3_TOOL_DRIFT"
  | "D4_RESOURCE_DRIFT"
  | "D5_TEMPORAL_DRIFT"
  | "D6_EVIDENCE_DRIFT"
  | "D7_AUTHORITY_DRIFT"
  | "D8_STRATEGY_DRIFT"
  | "D9_DELEGATION_DRIFT"
  | "D10_TRUTH_MEMORY_DRIFT";

export type DriftSeverity = "INFO" | "REVIEW" | "HARD_BLOCK" | "QUARANTINE";
export type DriftResponse = "ALLOW" | "PAUSE" | "REPLAN" | "REASSIGN" | "INVALIDATE" | "QUARANTINE";

export type DriftFinding = Readonly<{
  type: DriftType;
  severity: DriftSeverity;
  detector: string;
  response: DriftResponse;
  reason: string;
}>;

export const DRIFT_POLICY: Readonly<Record<DriftType, DriftSeverity>> = Object.freeze({
  D1_SCOPE_DRIFT: "HARD_BLOCK",
  D2_OBJECTIVE_DRIFT: "HARD_BLOCK",
  D3_TOOL_DRIFT: "HARD_BLOCK",
  D4_RESOURCE_DRIFT: "HARD_BLOCK",
  D5_TEMPORAL_DRIFT: "HARD_BLOCK",
  D6_EVIDENCE_DRIFT: "HARD_BLOCK",
  D7_AUTHORITY_DRIFT: "QUARANTINE",
  D8_STRATEGY_DRIFT: "REVIEW",
  D9_DELEGATION_DRIFT: "HARD_BLOCK",
  D10_TRUTH_MEMORY_DRIFT: "HARD_BLOCK",
});

const RESPONSE: Readonly<Record<DriftType, DriftResponse>> = Object.freeze({
  D1_SCOPE_DRIFT: "PAUSE",
  D2_OBJECTIVE_DRIFT: "REPLAN",
  D3_TOOL_DRIFT: "PAUSE",
  D4_RESOURCE_DRIFT: "PAUSE",
  D5_TEMPORAL_DRIFT: "PAUSE",
  D6_EVIDENCE_DRIFT: "INVALIDATE",
  D7_AUTHORITY_DRIFT: "QUARANTINE",
  D8_STRATEGY_DRIFT: "REPLAN",
  D9_DELEGATION_DRIFT: "PAUSE",
  D10_TRUTH_MEMORY_DRIFT: "INVALIDATE",
});

const finding = (type: DriftType, detector: string, reason: string): DriftFinding =>
  Object.freeze({ type, severity: DRIFT_POLICY[type], detector, response: RESPONSE[type], reason });

const HARD_SHA = /^[0-9a-f]{40}$/iu;

const normalizePath = (value: string): string | null => {
  const path = value.replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (!path || path.startsWith("/") || path.includes("\0")) return null;
  const parts = path.split("/");
  if (parts.some((part) => part === ".." || part === "." || part === "")) return null;
  return path;
};

const globRegex = (glob: string): RegExp | null => {
  const normalized = normalizePath(glob);
  if (!normalized) return null;
  let pattern = "";
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (char === "*" && normalized[i + 1] === "*") { pattern += ".*"; i += 1; }
    else if (char === "*") pattern += "[^/]*";
    else pattern += char.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + pattern + "$", "u");
};

export function matchesScope(path: string, scopes: readonly string[]): boolean {
  const normalized = normalizePath(path);
  if (!normalized) return false;
  return scopes.some((scope) => { const regex = globRegex(scope); return regex ? regex.test(normalized) : false; });
}

export type ExecutionEnvelope = Readonly<{
  taskId: string;
  agentId: string;
  sessionId: string;
  missionId: string;
  startSha: string;
  allowedCapabilities: readonly string[];
  readScope: readonly string[];
  writeScope: readonly string[];
  allowedBranch: string;
  forbiddenActions: readonly string[];
  expectedOutput: string;
  acceptanceConditions: readonly string[];
  evidenceRequirements: readonly string[];
  timeBudgetMs: number;
  costBudget: number;
  maxDelegationDepth: number;
  normalizedObjectiveId: string;
  acceptanceDigest: string;
  authority?: CellAuthority;
  maxRetryAttempts?: number;
}>;

export function createExecutionEnvelope(input: ExecutionEnvelope): ExecutionEnvelope {
  if (
    !input.taskId ||
    !input.agentId ||
    !input.sessionId ||
    !input.missionId ||
    !input.startSha ||
    !HARD_SHA.test(input.startSha) ||
    !input.allowedBranch ||
    input.allowedBranch === "main" ||
    !input.normalizedObjectiveId ||
    !input.expectedOutput ||
    !input.acceptanceDigest ||
    !Number.isFinite(input.timeBudgetMs) ||
    !Number.isFinite(input.costBudget) ||
    !Number.isFinite(input.maxDelegationDepth) ||
    input.timeBudgetMs <= 0 ||
    input.costBudget < 0 ||
    input.maxDelegationDepth < 0 ||
    input.allowedCapabilities.length === 0 ||
    input.acceptanceConditions.length === 0 ||
    input.evidenceRequirements.length === 0
  ) {
    throw new Error("INVALID_EXECUTION_ENVELOPE");
  }

  return Object.freeze({
    ...input,
    allowedCapabilities: Object.freeze([...input.allowedCapabilities]),
    readScope: Object.freeze([...input.readScope]),
    writeScope: Object.freeze([...input.writeScope]),
    forbiddenActions: Object.freeze([...input.forbiddenActions]),
    acceptanceConditions: Object.freeze([...input.acceptanceConditions]),
    evidenceRequirements: Object.freeze([...input.evidenceRequirements]),
    authority: input.authority ?? "SCOUT",
    maxRetryAttempts: Math.min(3, Math.max(1, Math.floor(input.maxRetryAttempts ?? 3))),
  });
}

export type ExecutionIdentityProbe = Readonly<{
  taskId: string; agentId: string; sessionId: string; missionId: string;
  branch: string; startSha: string; currentSha: string; capability: string;
  objectiveId: string; acceptanceDigest: string; expectedOutput: string;
}>;

export function verifyExecutionIdentity(envelope: ExecutionEnvelope, probe: ExecutionIdentityProbe): string | null {
  const checks: readonly [boolean, string][] = [
    [probe.taskId === envelope.taskId, "TASK_ID_MISMATCH"],
    [probe.agentId === envelope.agentId, "AGENT_ID_MISMATCH"],
    [probe.sessionId === envelope.sessionId, "SESSION_ID_MISMATCH"],
    [probe.missionId === envelope.missionId, "MISSION_ID_MISMATCH"],
    [probe.branch === envelope.allowedBranch && probe.branch !== "main", "BRANCH_MISMATCH"],
    [probe.startSha === envelope.startSha, "START_SHA_MISMATCH"],
    [envelope.allowedCapabilities.includes(probe.capability), "CAPABILITY_NOT_ALLOWED"],
    [probe.objectiveId === envelope.normalizedObjectiveId, "OBJECTIVE_DRIFT"],
    [probe.acceptanceDigest === envelope.acceptanceDigest, "ACCEPTANCE_DRIFT"],
    [probe.expectedOutput === envelope.expectedOutput, "EXPECTED_OUTPUT_MISMATCH"],
    [HARD_SHA.test(probe.currentSha), "CURRENT_SHA_INVALID"],
  ];
  for (const [ok, reason] of checks) if (!ok) return reason;
  return null;
}

export type ExecutionAction = Readonly<{
  actionId: string; taskId: string; agentId: string; sessionId: string; missionId: string;
  branch: string; startSha: string; currentSha: string; operation: "READ" | "WRITE" | "TEST" | "DELEGATE" | "COMMIT" | "BRANCH";
  path: string | null; objectiveId: string; acceptanceDigest: string; capability: string; toolId: string | null;
  estimatedCost: number; expectedDurationMs: number; delegationDepth: number; delegatedAuthority?: CellAuthority;
}>;

export type BudgetUsage = Readonly<{ spentCost: number; spentDurationMs: number }>;
export type ActionAuthorization = Readonly<{ allowed: boolean; drift: DriftFinding | null }>;

export function authorizeExecutionAction(envelope: ExecutionEnvelope, action: ExecutionAction, usage: BudgetUsage): ActionAuthorization {
  const identityReasons: readonly [boolean, DriftType, string, string][] = [
    [action.taskId === envelope.taskId, "D7_AUTHORITY_DRIFT", "identity-gate", "task identity mismatch"],
    [action.agentId === envelope.agentId, "D7_AUTHORITY_DRIFT", "identity-gate", "agent identity mismatch"],
    [action.sessionId === envelope.sessionId, "D7_AUTHORITY_DRIFT", "identity-gate", "session identity mismatch"],
    [action.missionId === envelope.missionId, "D7_AUTHORITY_DRIFT", "identity-gate", "mission identity mismatch"],
    [action.startSha === envelope.startSha, "D7_AUTHORITY_DRIFT", "identity-gate", "starting SHA mismatch"],
    [action.objectiveId === envelope.normalizedObjectiveId, "D2_OBJECTIVE_DRIFT", "objective-anchor", "objective mismatch"],
    [action.acceptanceDigest === envelope.acceptanceDigest, "D2_OBJECTIVE_DRIFT", "acceptance-anchor", "acceptance digest mismatch"],
  ];
  for (const [ok, type, detector, reason] of identityReasons) if (!ok) return { allowed: false, drift: finding(type, detector, reason) };

  if (!action.branch || action.branch !== envelope.allowedBranch || action.branch === "main") return { allowed: false, drift: finding("D1_SCOPE_DRIFT", "branch-firewall", "branch outside execution envelope") };
  if (!envelope.allowedCapabilities.includes(action.capability)) return { allowed: false, drift: finding("D3_TOOL_DRIFT", "capability-gate", "capability not allowed") };
  if (action.toolId && envelope.forbiddenActions.includes("tool:" + action.toolId)) return { allowed: false, drift: finding("D3_TOOL_DRIFT", "tool-firewall", "tool explicitly forbidden") };
  if (envelope.forbiddenActions.includes(action.operation)) return { allowed: false, drift: finding("D3_TOOL_DRIFT", "operation-firewall", "operation explicitly forbidden") };
  if (!Number.isFinite(action.estimatedCost) || !Number.isFinite(action.expectedDurationMs) || action.estimatedCost < 0 || action.expectedDurationMs < 0) return { allowed: false, drift: finding("D4_RESOURCE_DRIFT", "resource-gate", "invalid resource request") };
  if (usage.spentCost + action.estimatedCost > envelope.costBudget || usage.spentDurationMs + action.expectedDurationMs > envelope.timeBudgetMs) return { allowed: false, drift: finding("D4_RESOURCE_DRIFT", "resource-gate", "budget exceeded") };
  if (action.delegationDepth > envelope.maxDelegationDepth) return { allowed: false, drift: finding("D9_DELEGATION_DRIFT", "delegation-gate", "delegation depth exceeded") };
  if (action.delegatedAuthority) {
    if (!envelope.authority) return { allowed: false, drift: finding("D7_AUTHORITY_DRIFT", "authority-gate", "delegated authority requires an explicit parent authority") };
    if (authorityRank(action.delegatedAuthority) > authorityRank(envelope.authority)) {
      return { allowed: false, drift: finding("D9_DELEGATION_DRIFT", "authority-gate", "delegated authority exceeds parent authority") };
    }
  }
  if (action.operation === "WRITE" && action.path && matchesScope(action.path, CELL_PROTECTED_PATHS)) {
    if (envelope.authority !== "ROOT") {
      return { allowed: false, drift: finding("D7_AUTHORITY_DRIFT", "cell-self-protection", "CELL control-plane mutation requires ROOT authority") };
    }
  }
  if ((action.operation === "COMMIT" || action.operation === "BRANCH") && !envelope.authority) {
    return { allowed: false, drift: finding("D7_AUTHORITY_DRIFT", "mutation-authority-gate", "repository mutation requires explicit authority") };
  }
  if (!HARD_SHA.test(action.currentSha)) return { allowed: false, drift: finding("D6_EVIDENCE_DRIFT", "sha-gate", "action current SHA is missing or malformed") };
  if (action.operation === "WRITE" && (!action.path || !matchesScope(action.path, envelope.writeScope))) return { allowed: false, drift: finding("D1_SCOPE_DRIFT", "write-scope-firewall", "write path outside task scope") };
  if (action.operation === "READ" && (!action.path || !matchesScope(action.path, envelope.readScope))) return { allowed: false, drift: finding("D1_SCOPE_DRIFT", "read-scope-firewall", "read path outside task scope") };
  return { allowed: true, drift: null };
}

export type ProgressMetrics = Readonly<{
  verifiedObjectiveDelta: number; acceptanceCoverage: number; relevantArtifactScore: number;
  verifiedDelta: number; informationGain: number; budgetConsumed: number;
}>;

export function calculateProgressScore(metrics: ProgressMetrics): number {
  const n = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const evidence = n(metrics.verifiedObjectiveDelta) * 0.3 + n(metrics.acceptanceCoverage) * 0.2 + n(metrics.relevantArtifactScore) * 0.15 + n(metrics.verifiedDelta) * 0.2 + n(metrics.informationGain) * 0.15;
  return Number((evidence / Math.max(metrics.budgetConsumed, 0.000001)).toFixed(6));
}

export function classifyStrategyDrift(progressScore: number, threshold: number): DriftFinding | null {
  if (!Number.isFinite(progressScore) || progressScore < threshold) return finding("D8_STRATEGY_DRIFT", "progress-monitor", "verified objective progress below threshold");
  return null;
}

export function classifyTemporalDrift(nowMs: number, deadlineAtMs: number | null): DriftFinding | null {
  if (deadlineAtMs !== null && nowMs > deadlineAtMs) return finding("D5_TEMPORAL_DRIFT", "deadline-gate", "deadline exceeded");
  return null;
}

export function classifyObjectiveDrift(envelope: ExecutionEnvelope, observedObjectiveId: string): DriftFinding | null {
  if (observedObjectiveId !== envelope.normalizedObjectiveId) return finding("D2_OBJECTIVE_DRIFT", "objective-anchor", "objective changed after claim");
  return null;
}

export function classifyMemoryDrift(sourceSha: string, currentSha: string, admissionState: "PROMOTED" | "CANDIDATE" | "REVOKED"): DriftFinding | null {
  if (admissionState !== "PROMOTED" || sourceSha !== currentSha) return finding("D10_TRUTH_MEMORY_DRIFT", "memory-freshness-gate", "memory is not current and promoted");
  return null;
}

export function agentAllowedToAct(state: AgentState): boolean { return state === "WORKING"; }

export function outOfScopeProposal(taskId: string, agentId: string, discoveredPath: string): Readonly<{ taskId: string; agentId: string; path: string; action: "NEW_TASK_PROPOSAL" }> {
  if (!taskId || !agentId || !normalizePath(discoveredPath)) throw new Error("INVALID_OUT_OF_SCOPE_DISCOVERY");
  return Object.freeze({ taskId, agentId, path: discoveredPath.replaceAll("\\", "/"), action: "NEW_TASK_PROPOSAL" as const });
}

export function classifyScopeDrift(envelope: ExecutionEnvelope, action: ExecutionAction): DriftFinding | null {
  return authorizeExecutionAction(envelope, action, { spentCost: 0, spentDurationMs: 0 }).drift;
}


/**
 * Canonical hard-control assignment and runtime state contract.
 * Additive to the legacy primitives above; the hard-control lane uses these
 * names as the authoritative contract surface.
 */
export const HARD_TASK_STATES = Object.freeze([
  "QUEUED","ADMITTED","ASSIGNED","RUNNING","RECONCILING","VERIFYING",
  "BLOCKED","FAILED","READY_TO_CLOSE","CLOSED",
] as const);
export type HardTaskState = (typeof HARD_TASK_STATES)[number];

export const HARD_AGENT_STATES = Object.freeze([
  "DEFINED","READY","WORKING","DEGRADED","LOST","RECOVERABLE","QUARANTINED","RESTORED",
] as const);
export type HardAgentState = (typeof HARD_AGENT_STATES)[number];

export const HARD_TASK_TRANSITIONS: Readonly<Record<HardTaskState, readonly HardTaskState[]>> = Object.freeze({
  QUEUED: ["ADMITTED"],
  ADMITTED: ["ASSIGNED","BLOCKED","FAILED"],
  ASSIGNED: ["RUNNING","BLOCKED","FAILED"],
  RUNNING: ["RECONCILING","VERIFYING","BLOCKED","FAILED"],
  RECONCILING: ["RUNNING","VERIFYING","BLOCKED","FAILED"],
  VERIFYING: ["RECONCILING","READY_TO_CLOSE","BLOCKED","FAILED"],
  BLOCKED: ["QUEUED","ADMITTED","FAILED"],
  FAILED: ["QUEUED","BLOCKED"],
  READY_TO_CLOSE: ["VERIFYING","CLOSED"],
  CLOSED: [],
});

export const HARD_AGENT_TRANSITIONS: Readonly<Record<HardAgentState, readonly HardAgentState[]>> = Object.freeze({
  DEFINED: ["READY"],
  READY: ["WORKING"],
  WORKING: ["READY","DEGRADED","LOST"],
  DEGRADED: ["WORKING","LOST"],
  LOST: ["RECOVERABLE"],
  RECOVERABLE: ["QUARANTINED"],
  QUARANTINED: ["RESTORED"],
  RESTORED: ["READY"],
});

export type CanonicalScope = Readonly<{
  read: readonly string[];
  write: readonly string[];
  branches: readonly string[];
  tools: readonly string[];
  resources: readonly string[];
}>;

export type CanonicalBudget = Readonly<{ cost: number; durationMs: number }>;

export type CanonicalAssignmentRecord = Readonly<{
  assignmentId: string;
  taskId: string;
  missionId: string;
  solverId: string;
  opponentId: string;
  backupSolverId: string;
  backupOpponentId: string;
  riskClass: string;
  oppositionPlan: string;
  falsificationPolicy: string;
  independencePolicy: string;
  startingSha: string;
  scope: CanonicalScope;
  budget: CanonicalBudget;
  delegationDepth: number;
  handoffPolicy: string;
}>;

export const HARD_ASSIGNMENT_FIELDS = Object.freeze([
  "assignmentId","taskId","missionId","solverId","opponentId","backupSolverId",
  "backupOpponentId","riskClass","oppositionPlan","falsificationPolicy",
  "independencePolicy","startingSha","scope","budget","delegationDepth","handoffPolicy",
] as const);

export type LeaseFenceRecord = Readonly<{
  leaseId: string;
  ownerId: string;
  issuedAt: number;
  expiresAt: number;
  heartbeat: number;
  fenceToken: number;
  idempotencyKey: string;
}>;

export type EvidenceLineageNode = Readonly<{
  id: string;
  kind: "sourceSha"|"build"|"session"|"action"|"candidate"|"test"|"opponent"|"redTeam"|"verifier"|"certification"|"promotion";
  hash: string;
  identity: string;
  version: string;
  timestamp: number;
  parent: string | null;
}>;

const HARD_HASH = /^[0-9a-f]{64}$/iu;

export function validateCanonicalAssignment(record: CanonicalAssignmentRecord): CanonicalAssignmentRecord {
  const required = [
    record.assignmentId,record.taskId,record.missionId,record.solverId,record.opponentId,
    record.backupSolverId,record.backupOpponentId,record.riskClass,record.oppositionPlan,
    record.falsificationPolicy,record.independencePolicy,record.startingSha,record.handoffPolicy,
  ];
  if (required.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error("INVALID_CANONICAL_ASSIGNMENT");
  }
  if (!HARD_SHA.test(record.startingSha)) throw new Error("INVALID_ASSIGNMENT_STARTING_SHA");
  const ids = [record.solverId,record.opponentId,record.backupSolverId,record.backupOpponentId];
  if (new Set(ids).size !== ids.length) throw new Error("ASSIGNMENT_ROLE_INDEPENDENCE_VIOLATION");
  if (record.scope.read.length === 0 && record.scope.write.length === 0) throw new Error("ASSIGNMENT_SCOPE_REQUIRED");
  if (!Number.isFinite(record.budget.cost) || record.budget.cost < 0) throw new Error("ASSIGNMENT_COST_BUDGET_INVALID");
  if (!Number.isFinite(record.budget.durationMs) || record.budget.durationMs <= 0) throw new Error("ASSIGNMENT_DURATION_BUDGET_INVALID");
  if (!Number.isInteger(record.delegationDepth) || record.delegationDepth < 0) throw new Error("ASSIGNMENT_DELEGATION_DEPTH_INVALID");
  return Object.freeze({
    ...record,
    scope: Object.freeze({
      read:Object.freeze([...record.scope.read]),
      write:Object.freeze([...record.scope.write]),
      branches:Object.freeze([...record.scope.branches]),
      tools:Object.freeze([...record.scope.tools]),
      resources:Object.freeze([...record.scope.resources]),
    }),
    budget:Object.freeze({...record.budget}),
  });
}

export function canonicalTaskStateCanTransition(from: HardTaskState, to: HardTaskState): boolean {
  return HARD_TASK_TRANSITIONS[from].includes(to);
}

export function canonicalAgentStateCanTransition(from: HardAgentState, to: HardAgentState): boolean {
  return HARD_AGENT_TRANSITIONS[from].includes(to);
}

export function validateEvidenceLineageNode(node: EvidenceLineageNode): EvidenceLineageNode {
  if (!node.id || !node.identity || !node.version || !Number.isFinite(node.timestamp) || !HARD_HASH.test(node.hash)) {
    throw new Error("UNVERIFIABLE");
  }
  return Object.freeze({...node});
}
