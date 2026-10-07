import type { AgentState } from "./cell-control-plane";

export const HARD_CONTROL_CONTRACT_VERSION = "1.0.0" as const;

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
}>;

export function createExecutionEnvelope(input: ExecutionEnvelope): ExecutionEnvelope {
  if (
    !input.taskId ||
    !input.agentId ||
    !input.sessionId ||
    !input.missionId ||
    !input.startSha ||
    !input.allowedBranch ||
    input.allowedBranch === "main" ||
    !input.normalizedObjectiveId ||
    !input.expectedOutput ||
    !input.acceptanceDigest ||
    input.timeBudgetMs <= 0 ||
    input.costBudget < 0 ||
    input.maxDelegationDepth < 0
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
    [Boolean(probe.currentSha), "CURRENT_SHA_MISSING"],
  ];
  for (const [ok, reason] of checks) if (!ok) return reason;
  return null;
}

export type ExecutionAction = Readonly<{
  actionId: string; taskId: string; agentId: string; sessionId: string; missionId: string;
  branch: string; startSha: string; currentSha: string; operation: "READ" | "WRITE" | "TEST" | "DELEGATE" | "COMMIT" | "BRANCH";
  path: string | null; objectiveId: string; acceptanceDigest: string; capability: string; toolId: string | null;
  estimatedCost: number; expectedDurationMs: number; delegationDepth: number;
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
  if (action.operation === "WRITE" && (!action.path || !matchesScope(action.path, envelope.writeScope))) return { allowed: false, drift: finding("D1_SCOPE_DRIFT", "write-scope-firewall", "write path outside task scope") };
  if (action.operation === "READ" && (!action.path || !matchesScope(action.path, envelope.readScope))) return { allowed: false, drift: finding("D1_SCOPE_DRIFT", "read-scope-firewall", "read path outside task scope") };
  if ((action.operation === "WRITE" || action.operation === "DELEGATE") && !action.currentSha) return { allowed: false, drift: finding("D6_EVIDENCE_DRIFT", "sha-gate", "mutation/delegation has no current SHA") };
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
