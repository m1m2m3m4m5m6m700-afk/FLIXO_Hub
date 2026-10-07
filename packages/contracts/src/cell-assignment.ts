import type { AgentState } from "./cell-control-plane";

export const ASSIGNMENT_CONTRACT_VERSION = "1.1.0" as const;

export type AssignmentShaLineage = Readonly<{
  startingSha: string;
  currentSha: string;
}>;

const SHA_PATTERN = /^[0-9a-f]{40}$/iu;

export function validateAssignmentShaLineage(lineage: AssignmentShaLineage): void {
  if (!SHA_PATTERN.test(lineage.startingSha) || !SHA_PATTERN.test(lineage.currentSha)) {
    throw new Error("INVALID_ASSIGNMENT_SHA");
  }
}

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
  independenceKey?: string;
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
  startingSha: string;
  currentSha: string;
  deadlineAtMs?: number | null;
}>;

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const overlapScore = (required: readonly string[], available: readonly string[]): number => {
  if (required.length === 0) return 1;
  const set = new Set(available);
  return required.filter((item) => set.has(item)).length / required.length;
};

const safeRate = (value: number) => clamp(Number.isFinite(value) ? value : 0);

export function isAgentRoutableForTask(
  agent: AssignmentAgentProfile,
  task: AssignmentRequirements,
): boolean {
  validateAssignmentShaLineage({ startingSha: task.startingSha, currentSha: task.currentSha });
  return Boolean(
    agent.agentId.trim() &&
      (agent.state === "READY" || agent.state === "IDLE") &&
      Number.isFinite(agent.costRate) &&
      agent.costRate >= 0 &&
      agent.costRate <= task.maxCost &&
      agent.availability > 0 &&
      overlapScore(task.requiredCapabilities, agent.capabilities) === 1 &&
      overlapScore(task.requiredOutputTypes, agent.outputTypes) === 1 &&
      overlapScore([task.riskClass], agent.riskClasses) === 1,
  );
}

export type RankedAgent = Readonly<{
  agentId: string;
  score: number;
  reasons: readonly string[];
  independenceKey: string;
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
    independenceKey: agent.independenceKey?.trim() || agent.agentId,
  });
}

export function rankAgentsForTask(
  agents: readonly AssignmentAgentProfile[],
  task: AssignmentRequirements,
): readonly RankedAgent[] {
  return Object.freeze(
    agents
      .filter((agent) => isAgentRoutableForTask(agent, task))
      .map((agent) => scoreAgentForTask(agent, task))
      .filter((candidate) => candidate.score > -1)
      .sort(
        (left, right) =>
          right.score - left.score || left.agentId.localeCompare(right.agentId),
      ),
  );
}

export type AssignmentQuartet = Readonly<AssignmentShaLineage & {
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
  lineage: AssignmentShaLineage,
): AssignmentQuartet {
  validateAssignmentShaLineage(lineage);
  if (ranked.length < 2) throw new Error("ASSIGNMENT_REQUIRES_PRIMARY_AND_BACKUP");

  const verifierReserved = new Set(verifierCandidates);
  const primary = ranked.find((candidate) => !verifierReserved.has(candidate.agentId)) ?? ranked[0];
  const backup = ranked.find(
    (candidate) => candidate.agentId !== primary.agentId && !verifierReserved.has(candidate.agentId),
  ) ?? null;
  if (!backup) throw new Error("ASSIGNMENT_REQUIRES_BACKUP");

  const rankedIds = new Set(ranked.map((candidate) => candidate.agentId));
  const verifier =
    verifierCandidates.find(
      (agentId) =>
        agentId !== primary.agentId &&
        agentId !== backup.agentId &&
        rankedIds.has(agentId),
    ) ?? null;

  if (independenceRequired && !verifier) {
    throw new Error("INDEPENDENT_VERIFIER_REQUIRED");
  }

  const escalation =
    escalationCandidates.find(
      (agentId) =>
        agentId !== primary.agentId &&
        agentId !== backup.agentId &&
        agentId !== verifier &&
        rankedIds.has(agentId),
    ) ?? null;

  const roleIds = [primary.agentId, backup.agentId, verifier, escalation];
  if (new Set(roleIds.filter(Boolean)).size !== roleIds.filter(Boolean).length) {
    throw new Error("ASSIGNMENT_ROLE_COLLISION");
  }
  if (independenceRequired && verifier) {
    const vr = ranked.find((candidate) => candidate.agentId === verifier);
    if (!vr || vr.independenceKey === primary.independenceKey || vr.independenceKey === backup.independenceKey) {
      throw new Error("INDEPENDENT_VERIFIER_COLLISION");
    }
  }

  return Object.freeze({
    assignmentId,
    primaryAgentId: primary.agentId,
    backupAgentId: backup.agentId,
    verifierAgentId: verifier,
    escalationTargetAgentId: escalation,
    startingSha: lineage.startingSha,
    currentSha: lineage.currentSha,
  });
}

export type AssignmentTeam = Readonly<AssignmentShaLineage & {
  assignmentId: string;
  solverAgentId: string;
  backupSolverAgentId: string;
  opponentAgentId: string;
  backupOpponentAgentId: string | null;
  verifierAgentId: string | null;
  escalationTargetAgentId: string | null;
}>;

export function selectAssignmentTeam(input: Readonly<{
  assignmentId: string;
  solverRanked: readonly RankedAgent[];
  opponentRanked: readonly RankedAgent[];
  verifierCandidates: readonly string[];
  escalationCandidates: readonly string[];
  requireIndependentVerifier: boolean;
  requireBackupOpponent?: boolean;
  lineage: AssignmentShaLineage;
}>): AssignmentTeam {
  validateAssignmentShaLineage(input.lineage);
  if (input.solverRanked.length < 2) throw new Error("ASSIGNMENT_REQUIRES_PRIMARY_AND_BACKUP");
  const verifierReserved = new Set(input.verifierCandidates);
  const solver =
    input.solverRanked.find((candidate) => !verifierReserved.has(candidate.agentId)) ??
    input.solverRanked[0];
  const backupSolver = input.solverRanked.find(
    (candidate) =>
      candidate.agentId !== solver.agentId && !verifierReserved.has(candidate.agentId),
  );
  if (!backupSolver) throw new Error("ASSIGNMENT_REQUIRES_BACKUP");
  const opponent = input.opponentRanked.find(
    (candidate) =>
      candidate.agentId !== solver.agentId &&
      candidate.agentId !== backupSolver.agentId &&
      !verifierReserved.has(candidate.agentId) &&
      candidate.independenceKey !== solver.independenceKey &&
      candidate.independenceKey !== backupSolver.independenceKey,
  );
  if (!opponent) throw new Error("ASSIGNMENT_REQUIRES_INDEPENDENT_OPPONENT");
  const backupOpponent =
    input.opponentRanked.find(
      (candidate) =>
        ![solver.agentId, backupSolver.agentId, opponent.agentId].includes(candidate.agentId) &&
        ![solver.independenceKey, backupSolver.independenceKey, opponent.independenceKey].includes(candidate.independenceKey),
    ) ?? null;
  if (input.requireBackupOpponent && !backupOpponent) {
    throw new Error("BACKUP_OPPONENT_REQUIRED");
  }
  const rankedById = new Map(
    [...input.solverRanked, ...input.opponentRanked].map((candidate) => [candidate.agentId, candidate]),
  );
  const solverKeys = [
    solver.independenceKey,
    backupSolver.independenceKey,
    opponent.independenceKey,
  ];
  if (backupOpponent) solverKeys.push(backupOpponent.independenceKey);

  const verifier = input.verifierCandidates.find((agentId) => {
    if ([solver.agentId, backupSolver.agentId, opponent.agentId, backupOpponent?.agentId].includes(agentId)) {
      return false;
    }
    const candidate = rankedById.get(agentId);
    if (!candidate) return false;
    return !solverKeys.filter(Boolean).includes(candidate.independenceKey);
  }) ?? null;
  if (input.requireIndependentVerifier && !verifier) throw new Error("INDEPENDENT_VERIFIER_REQUIRED");
  const escalation = input.escalationCandidates.find(
    (agentId) =>
      ![solver.agentId, backupSolver.agentId, opponent.agentId, backupOpponent?.agentId, verifier].includes(agentId),
  ) ?? null;
  const roleIds = [solver.agentId, backupSolver.agentId, opponent.agentId, backupOpponent?.agentId ?? null, verifier, escalation];
  if (new Set(roleIds.filter(Boolean)).size !== roleIds.filter(Boolean).length) {
    throw new Error("ASSIGNMENT_ROLE_COLLISION");
  }
  if (input.requireIndependentVerifier && verifier) {
    const merged = [...input.solverRanked, ...input.opponentRanked];
    const vr = merged.find((candidate) => candidate.agentId === verifier);
    if (!vr || [solver.independenceKey, backupSolver.independenceKey, opponent.independenceKey].includes(vr.independenceKey)) {
      throw new Error("INDEPENDENT_VERIFIER_COLLISION");
    }
  }
  return Object.freeze({
    assignmentId: input.assignmentId,
    solverAgentId: solver.agentId,
    backupSolverAgentId: backupSolver.agentId,
    opponentAgentId: opponent.agentId,
    backupOpponentAgentId: backupOpponent?.agentId ?? null,
    verifierAgentId: verifier,
    escalationTargetAgentId: escalation,
    startingSha: input.lineage.startingSha,
    currentSha: input.lineage.currentSha,
  });
}
const agentMap = (agents: readonly AssignmentAgentProfile[]): ReadonlyMap<string, AssignmentAgentProfile> =>
  new Map(agents.map((agent) => [agent.agentId, agent]));

const routed = (task: AssignmentRequirements, profiles: ReadonlyMap<string, AssignmentAgentProfile>, id: string) => {
  const agent = profiles.get(id);
  if (!agent || !isAgentRoutableForTask(agent, task)) throw new Error("WRONG_AGENT_ROUTING");
  return agent;
};

export function validateAssignmentForTask(task: AssignmentRequirements, assignment: AssignmentQuartet, agents: readonly AssignmentAgentProfile[]): void {
  if (assignment.startingSha !== task.startingSha || assignment.currentSha !== task.currentSha) throw new Error("ASSIGNMENT_SHA_DRIFT");
  const ids = [assignment.primaryAgentId, assignment.backupAgentId, assignment.verifierAgentId, assignment.escalationTargetAgentId];
  if (new Set(ids.filter(Boolean)).size !== ids.filter(Boolean).length) throw new Error("ASSIGNMENT_ROLE_COLLISION");
  const m=agentMap(agents);
  const p=routed(task,m,assignment.primaryAgentId);
  const b=routed(task,m,assignment.backupAgentId);
  if (task.independenceRequired) {
    if (!assignment.verifierAgentId) throw new Error("INDEPENDENT_VERIFIER_REQUIRED");
    const v=routed(task,m,assignment.verifierAgentId);
    const vk=v.independenceKey?.trim()||v.agentId;
    if (vk===(p.independenceKey?.trim()||p.agentId) || vk===(b.independenceKey?.trim()||b.agentId)) throw new Error("INDEPENDENT_VERIFIER_COLLISION");
  }
  if (assignment.escalationTargetAgentId) routed(task,m,assignment.escalationTargetAgentId);
}

export function validateAssignmentTeamForTask(task: AssignmentRequirements, team: AssignmentTeam, agents: readonly AssignmentAgentProfile[]): void {
  if (team.startingSha !== task.startingSha || team.currentSha !== task.currentSha) throw new Error("ASSIGNMENT_SHA_DRIFT");
  const ids=[team.solverAgentId,team.backupSolverAgentId,team.opponentAgentId,team.backupOpponentAgentId,team.verifierAgentId,team.escalationTargetAgentId];
  if (new Set(ids.filter(Boolean)).size !== ids.filter(Boolean).length) throw new Error("ASSIGNMENT_ROLE_COLLISION");
  const m=agentMap(agents);
  const s=routed(task,m,team.solverAgentId);
  const b=routed(task,m,team.backupSolverAgentId);
  const o=routed(task,m,team.opponentAgentId);
  const sk=[s.independenceKey?.trim()||s.agentId,b.independenceKey?.trim()||b.agentId];
  const ok=o.independenceKey?.trim()||o.agentId;
  if (sk.includes(ok)) throw new Error("SOLVER_OPPONENT_COLLISION");
  if (team.backupOpponentAgentId) {
    const bo=routed(task,m,team.backupOpponentAgentId);
    const k=bo.independenceKey?.trim()||bo.agentId;
    if ([...sk,ok].includes(k)) throw new Error("BACKUP_OPPONENT_COLLISION");
  }
  if (task.independenceRequired) {
    if (!team.verifierAgentId) throw new Error("INDEPENDENT_VERIFIER_REQUIRED");
    const v=routed(task,m,team.verifierAgentId);
    const k=v.independenceKey?.trim()||v.agentId;
    if ([...sk,ok].includes(k)) throw new Error("INDEPENDENT_VERIFIER_COLLISION");
  }
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
  taskId: string;
  sourceAgentId: string;
  targetAgentId: string;
  taskType: string;
  riskClass: string;
  depth: number;
  activeSubtasks: number;
  estimatedCost: number;
  estimatedDurationMs: number;
}>;

const validRule=(r: DelegationRule)=>Boolean(r.sourceAgentId.trim()&&r.targetAgentId.trim()&&r.sourceAgentId!==r.targetAgentId&&r.taskTypes.length>0&&r.taskTypes.every((x)=>x.trim())&&r.riskClasses.length>0&&r.riskClasses.every((x)=>x.trim())&&Number.isInteger(r.maxDepth)&&r.maxDepth>=0&&Number.isInteger(r.maxActiveSubtasks)&&r.maxActiveSubtasks>=0&&Number.isFinite(r.maxCost)&&r.maxCost>=0&&Number.isFinite(r.maxDurationMs)&&r.maxDurationMs>0);
const validRequest=(r: DelegationRequest)=>Boolean(r.taskId.trim()&&r.sourceAgentId.trim()&&r.targetAgentId.trim()&&r.sourceAgentId!==r.targetAgentId&&r.taskType.trim()&&r.riskClass.trim()&&Number.isInteger(r.depth)&&r.depth>=0&&Number.isInteger(r.activeSubtasks)&&r.activeSubtasks>=0&&Number.isFinite(r.estimatedCost)&&r.estimatedCost>=0&&Number.isFinite(r.estimatedDurationMs)&&r.estimatedDurationMs>0);

export function authorizeDelegation(rules: readonly DelegationRule[],request: DelegationRequest): boolean {
  if(!validRequest(request)) return false;
  const rule=rules.find((candidate)=>validRule(candidate)&&candidate.sourceAgentId===request.sourceAgentId&&candidate.targetAgentId===request.targetAgentId&&candidate.taskTypes.includes(request.taskType)&&candidate.riskClasses.includes(request.riskClass));
  if(!rule) return false;
  return request.depth<=rule.maxDepth&&request.activeSubtasks<=rule.maxActiveSubtasks&&request.estimatedCost<=rule.maxCost&&request.estimatedDurationMs<=rule.maxDurationMs;
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
    !parentTaskId.trim() ||
    !subtaskId.trim() ||
    parentTaskId === subtaskId ||
    !spec.objective.trim() ||
    spec.contextRefs.length === 0 ||
    !spec.expectedOutput.trim() ||
    spec.requiredCapabilities.length === 0
  ) {
    throw new Error("INVALID_SUBTASK_SPEC");
  }

  if(spec.contextRefs.some((ref)=>!ref.trim())||spec.requiredCapabilities.some((capability)=>!capability.trim())) throw new Error("INVALID_SUBTASK_SPEC");
  return Object.freeze({subtaskId,parentTaskId,...spec});
}

export type TypedHandoff = Readonly<{
  handoffId: string;
  missionId: string;
  sessionId: string;
  taskId: string;
  parentTaskId: string | null;
  assignmentId: string;
  sourceAgentId: string;
  targetAgentId: string;
  taskType: string;
  riskClass: string;
  reason: string;
  objective: string;
  inputRefs: readonly string[];
  requiredCapabilities: readonly string[];
  expectedOutput: string;
  verificationCriteria: readonly string[];
  readScope: string;
  writeScope: string;
  startingSha: string;
  currentSha: string;
  deadlineAtMs: number | null;
  budget: Readonly<{ cost: number; durationMs: number }>;
  evidenceRequirements: readonly string[];
  returnContract: string;
}>;

export function validateTypedHandoff(handoff: TypedHandoff): void {
  const required = [handoff.handoffId,handoff.missionId,handoff.sessionId,handoff.taskId,handoff.assignmentId,handoff.sourceAgentId,handoff.targetAgentId,handoff.taskType,handoff.riskClass,handoff.reason,handoff.objective,handoff.expectedOutput,handoff.readScope,handoff.writeScope,handoff.returnContract];
  if (required.some((value) => typeof value !== "string" || !value.trim())) throw new Error("INVALID_TYPED_HANDOFF");
  if (handoff.sourceAgentId === handoff.targetAgentId) throw new Error("SELF_HANDOFF_FORBIDDEN");
  const nonEmpty=(values: readonly string[])=>values.length>0&&values.every((value)=>value.trim().length>0);
  if (!nonEmpty(handoff.inputRefs)||!nonEmpty(handoff.requiredCapabilities)) throw new Error("HANDOFF_INPUTS_AND_CAPABILITIES_REQUIRED");
  if (!nonEmpty(handoff.verificationCriteria)) throw new Error("HANDOFF_VERIFICATION_REQUIRED");
  if (!nonEmpty(handoff.evidenceRequirements)) throw new Error("HANDOFF_EVIDENCE_REQUIRED");
  validateAssignmentShaLineage({startingSha:handoff.startingSha,currentSha:handoff.currentSha});
  if (handoff.deadlineAtMs!==null&&(!Number.isFinite(handoff.deadlineAtMs)||handoff.deadlineAtMs<0)) throw new Error("HANDOFF_INVALID_DEADLINE");
  if (handoff.budget.cost<0||!Number.isFinite(handoff.budget.cost)||handoff.budget.durationMs<=0||!Number.isFinite(handoff.budget.durationMs)) throw new Error("HANDOFF_INVALID_BUDGET");
}

export function delegateHandoff(rules: readonly DelegationRule[],request: DelegationRequest,handoff: TypedHandoff): TypedHandoff {
  validateTypedHandoff(handoff);
  if (handoff.taskId!==request.taskId||handoff.sourceAgentId!==request.sourceAgentId||handoff.targetAgentId!==request.targetAgentId||handoff.taskType!==request.taskType||handoff.riskClass!==request.riskClass) throw new Error("DELEGATION_CONTEXT_MISMATCH");
  if (handoff.budget.cost>request.estimatedCost||handoff.budget.durationMs>request.estimatedDurationMs) throw new Error("DELEGATION_BUDGET_MISMATCH");
  if (!authorizeDelegation(rules,request)) throw new Error("DELEGATION_REJECTED");
  return Object.freeze({...handoff});
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
  if (!Number.isInteger(consecutiveStalls) || consecutiveStalls < 0) throw new Error("INVALID_STALL_COUNT");
  if (state === "COMPLETE" || state === "ON_TRACK") return "CONTINUE";
  if (state === "SLOW") return "REASSIGN";
  if (state === "STALLED" && consecutiveStalls < 2) return "REASSIGN";
  if (state === "STALLED") return "REPLAN";
  if (state === "BLOCKED") return "ESCALATE";
  if (state === "RECOVERING") return "REASSIGN";
  return "CONTINUE";
}
