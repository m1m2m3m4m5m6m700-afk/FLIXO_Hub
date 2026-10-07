export const CALL_MISSION_CONTROL_VERSION = "1.0.0" as const;

export type MissionTermination = "ACTIVE" | "COMPLETED" | "HALTED" | "ESCALATED";
export type EscalationState = "NONE" | "PENDING" | "AUTHORIZED" | "RESOLVED";

export type MissionBudget = Readonly<{
  wallclockMs: number;
  agentRuns: number;
  retries: number;
  externalCalls: number;
}>;

export type MissionControlRecord = Readonly<{
  missionId: string;
  objectiveId: string;
  owner: string;
  priority: number;
  riskClass: string;
  acceptedAtMs: number;
  deadlineAtMs: number;
  budget: MissionBudget;
  spent: MissionBudget;
  planVersion: string;
  assignmentVersion: string;
  currentStage: string;
  currentSha: string;
  acceptanceCriteria: readonly string[];
  terminationState: MissionTermination;
  escalationState: EscalationState;
  evidenceIndex: readonly string[];
  artifactIndex: readonly string[];
  decisionLog: readonly string[];
}>;

function finiteNonNegative(value: number, code: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(code);
}

export function validateMissionBudget(budget: MissionBudget): void {
  finiteNonNegative(budget.wallclockMs, "MISSION_BUDGET_WALLCLOCK_INVALID");
  finiteNonNegative(budget.agentRuns, "MISSION_BUDGET_AGENT_RUNS_INVALID");
  finiteNonNegative(budget.retries, "MISSION_BUDGET_RETRIES_INVALID");
  finiteNonNegative(budget.externalCalls, "MISSION_BUDGET_EXTERNAL_CALLS_INVALID");
}

export function remainingBudget(record: MissionControlRecord): MissionBudget {
  validateMissionBudget(record.budget);
  validateMissionBudget(record.spent);
  return Object.freeze({
    wallclockMs: Math.max(0, record.budget.wallclockMs - record.spent.wallclockMs),
    agentRuns: Math.max(0, record.budget.agentRuns - record.spent.agentRuns),
    retries: Math.max(0, record.budget.retries - record.spent.retries),
    externalCalls: Math.max(0, record.budget.externalCalls - record.spent.externalCalls),
  });
}

export function budgetExhausted(record: MissionControlRecord): boolean {
  const remaining = remainingBudget(record);
  return Object.values(remaining).some((value) => value <= 0);
}

export function terminateMission(
  record: MissionControlRecord,
  state: Exclude<MissionTermination, "ACTIVE">,
): MissionControlRecord {
  if (record.terminationState !== "ACTIVE") throw new Error("MISSION_ALREADY_TERMINATED");
  if (state === "COMPLETED" && record.escalationState === "PENDING") {
    throw new Error("ESCALATED_MISSION_CANNOT_COMPLETE");
  }
  if (state === "COMPLETED" && budgetExhausted(record)) {
    throw new Error("BUDGET_EXHAUSTED");
  }
  return Object.freeze({...record, terminationState: state});
}

export function assertAutonomousRecoveryAllowed(record: MissionControlRecord): void {
  if (record.terminationState !== "ACTIVE") throw new Error("MISSION_NOT_ACTIVE");
  if (record.escalationState === "AUTHORIZED") throw new Error("HUMAN_ESCALATION_IN_PROGRESS");
  if (budgetExhausted(record)) throw new Error("BUDGET_EXHAUSTED");
}
