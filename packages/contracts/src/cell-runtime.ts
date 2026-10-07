
import {
  assertLeaseOwner,
  assertTransition,
  canPromote,
  isLeaseLive,
  type CandidateState,
  type Lease,
  type PromotionGate,
  type TaskState,
} from "./cell-control-plane";
import {
  authorizeExecutionAction,
  calculateProgressScore,
  classifyObjectiveDrift,
  classifyScopeDrift,
  classifyStrategyDrift,
  classifyTemporalDrift,
  outOfScopeProposal,
  verifyExecutionIdentity,
  type ActionAuthorization,
  type ExecutionAction,
  type ExecutionEnvelope,
  type ExecutionIdentityProbe,
  type ProgressMetrics,
} from "./cell-hard-control";
import {
  decideProgressAction,
  evaluateProgress,
  validateTypedHandoff,
  type AssignmentQuartet,
  type ProgressObservation,
  type ReplanDecision,
  type TypedHandoff,
} from "./cell-assignment";

export type RuntimeTask = Readonly<{
  taskId: string;
  state: TaskState;
  version: number;
  checkpointId: string | null;
  lease: Lease | null;
}>;

export type RuntimeCandidate = Readonly<{
  candidateId: string;
  state: CandidateState;
  version: number;
}>;

export type RuntimeAssignment = Readonly<{
  taskId: string;
  assignment: AssignmentQuartet;
  version: number;
}>;

export type RuntimeBudget = Readonly<{ spentCost: number; spentDurationMs: number }>;

export type RuntimeActionRecord = Readonly<ExecutionAction & {
  allowed: boolean;
  recordedAtMs: number;
  driftType: string | null;
}>;

export class CellRuntime {
  private readonly tasks = new Map<string, RuntimeTask>();
  private readonly candidates = new Map<string, RuntimeCandidate>();
  private readonly assignments = new Map<string, RuntimeAssignment>();
  private readonly handoffs = new Map<string, TypedHandoff>();
  private readonly progress = new Map<string, ProgressObservation[]>();
  private readonly budgets = new Map<string, RuntimeBudget>();
  private readonly actions: RuntimeActionRecord[] = [];
  private readonly claimedOperations = new Set<string>();
  private readonly clock: () => number;

  constructor(clock: () => number = () => Date.now()) {
    this.clock = clock;
  }

  registerTask(taskId: string): RuntimeTask {
    if (!taskId || this.tasks.has(taskId)) throw new Error("TASK_ALREADY_REGISTERED");
    const task: RuntimeTask = Object.freeze({
      taskId,
      state: "PLANNED",
      version: 0,
      checkpointId: null,
      lease: null,
    });
    this.tasks.set(taskId, task);
    return task;
  }

  getTask(taskId: string): RuntimeTask {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error("TASK_NOT_FOUND");
    return task;
  }

  transitionTask(taskId: string, to: TaskState, expectedVersion?: number): RuntimeTask {
    const current = this.getTask(taskId);
    if (expectedVersion !== undefined && current.version !== expectedVersion) {
      throw new Error("TASK_VERSION_CONFLICT");
    }
    assertTransition("TASK", current.state, to);
    const next = Object.freeze({
      ...current,
      state: to,
      version: current.version + 1,
    });
    this.tasks.set(taskId, next);
    return next;
  }

  acquireTaskLease(taskId: string, ownerId: string, token: string, ttlMs: number): Lease {
    const current = this.getTask(taskId);
    const now = this.clock();
    if (!ownerId || !token || !Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error("INVALID_LEASE_REQUEST");
    }
    if (current.lease && isLeaseLive(current.lease, now)) {
      throw new Error("LEASE_ALREADY_HELD");
    }

    const lease: Lease = Object.freeze({
      ownerId,
      token,
      acquiredAtMs: now,
      expiresAtMs: now + ttlMs,
    });
    this.tasks.set(taskId, Object.freeze({ ...current, lease, version: current.version + 1 }));
    return lease;
  }

  releaseTaskLease(taskId: string, ownerId: string, token: string): RuntimeTask {
    const current = this.getTask(taskId);
    if (!current.lease) throw new Error("LEASE_NOT_FOUND");
    assertLeaseOwner(current.lease, ownerId, token, this.clock());
    const next = Object.freeze({
      ...current,
      lease: null,
      version: current.version + 1,
    });
    this.tasks.set(taskId, next);
    return next;
  }

  checkpointTask(taskId: string, checkpointId: string): RuntimeTask {
    if (!checkpointId) throw new Error("CHECKPOINT_ID_REQUIRED");
    const current = this.getTask(taskId);
    if (current.state !== "RUNNING" && current.state !== "CHECKPOINTED") {
      throw new Error("CHECKPOINT_NOT_ALLOWED");
    }
    const nextState: TaskState = current.state === "RUNNING" ? "CHECKPOINTED" : current.state;
    if (nextState !== current.state) return this.transitionTask(taskId, nextState);
    const next = Object.freeze({
      ...current,
      checkpointId,
      version: current.version + 1,
    });
    this.tasks.set(taskId, next);
    return next;
  }

  claimIdempotentOperation(operationKey: string): boolean {
    if (!operationKey) throw new Error("OPERATION_KEY_REQUIRED");
    if (this.claimedOperations.has(operationKey)) return false;
    this.claimedOperations.add(operationKey);
    return true;
  }

  assignTask(taskId: string, assignment: AssignmentQuartet): RuntimeAssignment {
    const task = this.getTask(taskId);
    if (task.state !== "READY") throw new Error("ASSIGNMENT_REQUIRES_READY_TASK");
    if (this.assignments.has(assignment.assignmentId)) throw new Error("ASSIGNMENT_ALREADY_EXISTS");
    const record = Object.freeze({ taskId, assignment, version: 0 });
    this.assignments.set(assignment.assignmentId, record);
    return record;
  }

  getAssignment(assignmentId: string): RuntimeAssignment {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");
    return assignment;
  }

  createHandoff(handoff: TypedHandoff): TypedHandoff {
    validateTypedHandoff(handoff);
    if (!this.assignments.has(handoff.assignmentId)) throw new Error("HANDOFF_ASSIGNMENT_NOT_FOUND");
    if (this.handoffs.has(handoff.handoffId)) throw new Error("HANDOFF_ALREADY_EXISTS");
    this.handoffs.set(handoff.handoffId, handoff);
    return handoff;
  }

  authorizeIdentity(envelope: ExecutionEnvelope, probe: ExecutionIdentityProbe): void {
    const reason = verifyExecutionIdentity(envelope, probe);
    if (reason) throw new Error(reason);
  }

  authorizeAction(
    envelope: ExecutionEnvelope,
    action: ExecutionAction,
    liveSha: string,
  ): ActionAuthorization {
    const usage = this.budgets.get(envelope.taskId) ?? { spentCost: 0, spentDurationMs: 0 };

    const task = this.getTask(envelope.taskId);
    if (task.state !== "RUNNING") {
      const denied: ActionAuthorization = {
        allowed: false,
        drift: {
          type: "D7_AUTHORITY_DRIFT",
          severity: "QUARANTINE",
          detector: "task-state-gate",
          response: "QUARANTINE",
          reason: "execution action requested while task is not RUNNING",
        },
      };
      this.actions.push(
        Object.freeze({
          ...action,
          allowed: false,
          recordedAtMs: this.clock(),
          driftType: denied.drift?.type ?? null,
        }),
      );
      return denied;
    }

    if (action.currentSha !== liveSha) {
      const denied: ActionAuthorization = {
        allowed: false,
        drift: {
          type: "D6_EVIDENCE_DRIFT",
          severity: "HARD_BLOCK",
          detector: "live-sha-gate",
          response: "INVALIDATE",
          reason: "action SHA does not match live execution SHA",
        },
      };
      this.actions.push(Object.freeze({ ...action, allowed: false, recordedAtMs: this.clock(), driftType: denied.drift?.type ?? null }));
      return denied;
    }

    const result = authorizeExecutionAction(envelope, action, usage);

    this.actions.push(
      Object.freeze({
        ...action,
        allowed: result.allowed,
        recordedAtMs: this.clock(),
        driftType: result.drift?.type ?? null,
      }),
    );

    if (result.allowed) {
      this.budgets.set(
        envelope.taskId,
        Object.freeze({
          spentCost: usage.spentCost + action.estimatedCost,
          spentDurationMs: usage.spentDurationMs + action.expectedDurationMs,
        }),
      );
    }

    return result;
  }

  getTaskBudget(taskId: string): RuntimeBudget {
    return this.budgets.get(taskId) ?? { spentCost: 0, spentDurationMs: 0 };
  }

  listActionRecords(): readonly RuntimeActionRecord[] {
    return Object.freeze([...this.actions]);
  }

  evaluateProgressScore(metrics: ProgressMetrics): number {
    return calculateProgressScore(metrics);
  }

  detectStrategyDrift(progressScore: number, threshold: number): string | null {
    return classifyStrategyDrift(progressScore, threshold)?.type ?? null;
  }

  detectObjectiveDrift(envelope: ExecutionEnvelope, observedObjectiveId: string): string | null {
    return classifyObjectiveDrift(envelope, observedObjectiveId)?.type ?? null;
  }

  detectTemporalDrift(nowMs: number, deadlineAtMs: number | null): string | null {
    return classifyTemporalDrift(nowMs, deadlineAtMs)?.type ?? null;
  }

  detectScopeDrift(envelope: ExecutionEnvelope, action: ExecutionAction): string | null {
    return classifyScopeDrift(envelope, action)?.type ?? null;
  }

  proposeOutOfScopeTask(taskId: string, agentId: string, discoveredPath: string) {
    return outOfScopeProposal(taskId, agentId, discoveredPath);
  }

  recordProgress(observation: ProgressObservation): ReplanDecision {
    const history = this.progress.get(observation.taskId) ?? [];
    const next = [...history, observation];
    this.progress.set(observation.taskId, next);
    const state = evaluateProgress(next, this.clock(), 500);
    const previousStalls = history.filter((entry) => entry.state === "STALLED").length;
    return decideProgressAction(state, previousStalls);
  }

  registerCandidate(candidateId: string): RuntimeCandidate {
    if (!candidateId || this.candidates.has(candidateId)) throw new Error("CANDIDATE_ALREADY_REGISTERED");
    const candidate = Object.freeze({ candidateId, state: "CREATED" as const, version: 0 });
    this.candidates.set(candidateId, candidate);
    return candidate;
  }


  transitionCandidate(candidateId: string, to: CandidateState, expectedVersion?: number): RuntimeCandidate {
    const current = this.candidates.get(candidateId);
    if (!current) throw new Error("CANDIDATE_NOT_FOUND");
    if (expectedVersion !== undefined && current.version !== expectedVersion) {
      throw new Error("CANDIDATE_VERSION_CONFLICT");
    }
    assertTransition("CANDIDATE", current.state, to);
    const next = Object.freeze({ ...current, state: to, version: current.version + 1 });
    this.candidates.set(candidateId, next);
    return next;
  }

  promoteCandidate(candidateId: string, gate: PromotionGate, currentRuntimeSha: string): RuntimeCandidate {
    const current = this.candidates.get(candidateId);
    if (!current) throw new Error("CANDIDATE_NOT_FOUND");
    if (current.state !== gate.candidateState) throw new Error("CANDIDATE_STATE_MISMATCH");
    if (!canPromote(gate, currentRuntimeSha)) throw new Error("PROMOTION_DENIED");
    assertTransition("CANDIDATE", current.state, "PROMOTED");
    const next = Object.freeze({
      ...current,
      state: "PROMOTED" as const,
      version: current.version + 1,
    });
    this.candidates.set(candidateId, next);
    return next;
  }
}
