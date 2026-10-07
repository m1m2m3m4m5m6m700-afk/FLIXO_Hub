import type { AgentState } from "./cell-control-plane";

export const ASSIGNMENT_CONTRACT_VERSION = "1.0.0" as const;

export type AssignmentAgentProfile = Readonly<{
  agentId: string;
  capabilities: readonly string[];
  outputTypes: readonly string[];
  riskClasses: readonly string[];
  verificationStrength: number;
  reliability: number;
  contextFit: number;
  recoveryQuality: number;
  informationGain: number;
  recentFailureRate: number;
  falsePositiveRate: number;
  falseGreenHistory: number;
  availability: number;
  costRate: number;
  state: AgentState;
}>;

export type AssignmentRequirements = Readonly<{
  taskId: string;
  requiredCapabilities: readonly string[];
  requiredOutputTypes: readonly string[];
  riskClass: string;
  writeScope: string;
  verificationBurden: number;
  informationGain: number;
  independenceRequired: boolean;
  maxCost: number;
  deadlineAtMs?: number | null;
}>;

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const overlapScore = (required: readonly string[], available: readonly string[]): number => {
  if (required.length === 0) return 1;
  const set = new Set(available);
  return required.filter((item) => set.has(item)).length / required.length;
};

const safeRate = (value: number) => clamp(Number.isFinite(value) ? value : 0);

export type RankedAgent = Readonly<{
  agentId: string;
  score: number;
  reasons: readonly string[];
}>;

export function scoreAgentForTask(
  agent: AssignmentAgentProfile,
  task: AssignmentRequirements,
): RankedAgent {
  const capabilityFit = overlapScore(task.requiredCapabilities, agent.capabilities);
  const artifactFit = overlapScore(task.requiredOutputTypes, agent.outputTypes);
  const riskFit = overlapScore([task.riskClass], agent.riskClasses);
  const availability = clamp(agent.availability);
  const reliability = clamp(agent.reliability);
  const evidenceQuality = clamp(agent.verificationStrength);
  const contextFit = clamp(agent.contextFit);
  const recoveryQuality = clamp(agent.recoveryQuality);
  const informationGain = clamp((agent.informationGain + task.informationGain) / 2);
  const independencePenalty = task.independenceRequired && agent.state === "WORKING" ? 0.15 : 0;
  const failurePenalty =
    safeRate(agent.recentFailureRate) * 0.12 +
    safeRate(agent.falsePositiveRate) * 0.08 +
    safeRate(agent.falseGreenHistory) * 0.2;
  const verificationPenalty = clamp(task.verificationBurden) * (1 - evidenceQuality) * 0.1;
  const costPenalty = clamp(agent.costRate / Math.max(task.maxCost, 1)) * 0.12;

  const score =
    capabilityFit * 0.23 +
    artifactFit * 0.14 +
    riskFit * 0.1 +
    availability * 0.1 +
    reliability * 0.14 +
    evidenceQuality * 0.1 +
    contextFit * 0.06 +
    recoveryQuality * 0.05 +
    informationGain * 0.06 -
    independencePenalty -
    failurePenalty -
    verificationPenalty -
    costPenalty;

  const reasons = [
    capabilityFit === 1 ? "capability-fit" : "capability-gap",
    artifactFit === 1 ? "artifact-fit" : "artifact-gap",
    reliability >= 0.8 ? "reliable" : "reliability-risk",
    evidenceQuality >= 0.8 ? "strong-verification" : "verification-risk",
    availability >= 0.8 ? "available" : "availability-risk",
  ];

  return Object.freeze({
    agentId: agent.agentId,
    score: Number(score.toFixed(6)),
    reasons: Object.freeze(reasons),
  });
}

export function rankAgentsForTask(
  agents: readonly AssignmentAgentProfile[],
  task: AssignmentRequirements,
): readonly RankedAgent[] {
  return Object.freeze(
    agents
      .map((agent) => scoreAgentForTask(agent, task))
      .filter((candidate) => candidate.score > -1)
      .sort(
        (left, right) =>
          right.score - left.score || left.agentId.localeCompare(right.agentId),
      ),
  );
}

export type AssignmentQuartet = Readonly<{
  assignmentId: string;
  primaryAgentId: string;
  backupAgentId: string;
  verifierAgentId: string | null;
  escalationTargetAgentId: string | null;
}>;

export function selectAssignmentQuartet(
  assignmentId: string,
  ranked: readonly RankedAgent[],
  verifierCandidates: readonly string[],
  escalationCandidates: readonly string[],
  independenceRequired: boolean,
): AssignmentQuartet {
  if (ranked.length < 2) throw new Error("ASSIGNMENT_REQUIRES_PRIMARY_AND_BACKUP");

  const primary = ranked[0];
  const backup = ranked.find((candidate) => candidate.agentId !== primary.agentId) ?? null;
  if (!backup) throw new Error("ASSIGNMENT_REQUIRES_BACKUP");

  const verifier =
    verifierCandidates.find(
      (agentId) =>
        agentId !== primary.agentId && agentId !== backup.agentId,
    ) ?? null;

  if (independenceRequired && !verifier) {
    throw new Error("INDEPENDENT_VERIFIER_REQUIRED");
  }

  const escalation =
    escalationCandidates.find(
      (agentId) =>
        agentId !== primary.agentId &&
        agentId !== backup.agentId &&
        agentId !== verifier,
    ) ?? null;

  return Object.freeze({
    assignmentId,
    primaryAgentId: primary.agentId,
    backupAgentId: backup.agentId,
    verifierAgentId: verifier,
    escalationTargetAgentId: escalation,
  });
}

export type DelegationRule = Readonly<{
  sourceAgentId: string;
  targetAgentId: string;
  taskTypes: readonly string[];
  riskClasses: readonly string[];
  maxDepth: number;
  maxActiveSubtasks: number;
  maxCost: number;
  maxDurationMs: number;
}>;

export type DelegationRequest = Readonly<{
  sourceAgentId: string;
  targetAgentId: string;
  taskType: string;
  riskClass: string;
  depth: number;
  activeSubtasks: number;
  estimatedCost: number;
  estimatedDurationMs: number;
}>;

export function authorizeDelegation(
  rules: readonly DelegationRule[],
  request: DelegationRequest,
): boolean {
  const rule = rules.find(
    (candidate) =>
      candidate.sourceAgentId === request.sourceAgentId &&
      candidate.targetAgentId === request.targetAgentId &&
      candidate.taskTypes.includes(request.taskType) &&
      candidate.riskClasses.includes(request.riskClass),
  );

  if (!rule) return false;

  return (
    request.depth <= rule.maxDepth &&
    request.activeSubtasks <= rule.maxActiveSubtasks &&
    request.estimatedCost <= rule.maxCost &&
    request.estimatedDurationMs <= rule.maxDurationMs
  );
}

export type SubtaskSpec = Readonly<{
  subtaskId: string;
  parentTaskId: string;
  objective: string;
  contextRefs: readonly string[];
  requiredCapabilities: readonly string[];
  expectedOutput: string;
}>;

export function spawnSubtask(
  parentTaskId: string,
  subtaskId: string,
  spec: Omit<SubtaskSpec, "subtaskId" | "parentTaskId">,
): SubtaskSpec {
  if (
    !parentTaskId ||
    !subtaskId ||
    !spec.objective ||
    !spec.expectedOutput ||
    spec.requiredCapabilities.length === 0
  ) {
    throw new Error("INVALID_SUBTASK_SPEC");
  }

  return Object.freeze({
    subtaskId,
    parentTaskId,
    ...spec,
  });
}

export type TypedHandoff = Readonly<{
  handoffId: string;
  taskId: string;
  parentTaskId: string | null;
  assignmentId: string;
  sourceAgentId: string;
  targetAgentId: string;
  reason: string;
  objective: string;
  inputRefs: readonly string[];
  requiredCapabilities: readonly string[];
  expectedOutput: string;
  verificationCriteria: readonly string[];
  readScope: string;
  writeScope: string;
  currentSha: string;
  deadlineAtMs: number | null;
  budget: Readonly<{ cost: number; durationMs: number }>;
  evidenceRequirements: readonly string[];
  returnContract: string;
}>;

export function validateTypedHandoff(handoff: TypedHandoff): void {
  const requiredStrings = [
    handoff.handoffId,
    handoff.taskId,
    handoff.assignmentId,
    handoff.sourceAgentId,
    handoff.targetAgentId,
    handoff.reason,
    handoff.objective,
    handoff.expectedOutput,
    handoff.writeScope,
    handoff.currentSha,
    handoff.returnContract,
  ];

  if (requiredStrings.some((value) => !value.trim())) {
    throw new Error("INVALID_TYPED_HANDOFF");
  }

  if (handoff.sourceAgentId === handoff.targetAgentId) {
    throw new Error("SELF_HANDOFF_FORBIDDEN");
  }

  if (handoff.requiredCapabilities.length === 0) {
    throw new Error("HANDOFF_CAPABILITIES_REQUIRED");
  }

  if (handoff.verificationCriteria.length === 0) {
    throw new Error("HANDOFF_VERIFICATION_REQUIRED");
  }

  if (
    handoff.budget.cost < 0 ||
    handoff.budget.durationMs < 0 ||
    !Number.isFinite(handoff.budget.cost) ||
    !Number.isFinite(handoff.budget.durationMs)
  ) {
    throw new Error("HANDOFF_INVALID_BUDGET");
  }
}

export type ProgressState =
  | "NOT_STARTED"
  | "ON_TRACK"
  | "SLOW"
  | "STALLED"
  | "BLOCKED"
  | "RECOVERING"
  | "COMPLETE";

export type ProgressObservation = Readonly<{
  taskId: string;
  assignmentId: string;
  agentId: string;
  observedAtMs: number;
  progressPercent: number;
  usefulOutputCount: number;
  lastEvidenceAtMs: number | null;
  state: ProgressState;
  blocker: string | null;
  nextAction: string;
}>;

export function evaluateProgress(
  history: readonly ProgressObservation[],
  nowMs: number,
  stallWindowMs: number,
): ProgressState {
  const latest = history[history.length - 1];

  if (!latest) return "NOT_STARTED";

  if (
    latest.state === "COMPLETE" ||
    latest.state === "BLOCKED" ||
    latest.state === "RECOVERING"
  ) {
    return latest.state;
  }

  if (history.length < 2) {
    return latest.progressPercent > 0 ? "ON_TRACK" : "SLOW";
  }

  const previous = history[history.length - 2];
  const progressed =
    latest.progressPercent > previous.progressPercent ||
    latest.usefulOutputCount > previous.usefulOutputCount ||
    (latest.lastEvidenceAtMs ?? 0) > (previous.lastEvidenceAtMs ?? 0);

  if (progressed) return "ON_TRACK";
  if (nowMs - previous.observedAtMs >= stallWindowMs) return "STALLED";
  return "SLOW";
}

export type ReplanDecision =
  | "CONTINUE"
  | "REASSIGN"
  | "ESCALATE"
  | "REPLAN";

export function decideProgressAction(
  state: ProgressState,
  consecutiveStalls: number,
): ReplanDecision {
  if (state === "COMPLETE" || state === "ON_TRACK") return "CONTINUE";
  if (state === "SLOW") return "REASSIGN";
  if (state === "STALLED" && consecutiveStalls < 2) return "REASSIGN";
  if (state === "STALLED") return "REPLAN";
  if (state === "BLOCKED") return "ESCALATE";
  if (state === "RECOVERING") return "REASSIGN";
  return "CONTINUE";
}
