
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
  delegateHandoff,
  evaluateProgress,
  validateTypedHandoff,
  type AssignmentQuartet,
  type AssignmentTeam,
  type DelegationRequest,
  type DelegationRule,
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
  previousAssignmentId: string | null;
  attempt: number;
  reason: string | null;
}>;

export type RuntimeAssignmentTeam = Readonly<{
  taskId: string;
  team: AssignmentTeam;
  version: number;
  previousAssignmentId: string | null;
  attempt: number;
  reason: string | null;
}>;

export type RuntimeAssignmentLease = Readonly<{
  assignmentId: string;
  taskId: string;
  startingSha: string;
  currentSha: string;
  lease: Lease;
}>;

export type RuntimeAssignmentLineage = Readonly<{
  assignmentId: string;
  taskId: string;
  previousAssignmentId: string | null;
  attempt: number;
  reason: string | null;
}>;

export type RuntimeBudget = Readonly<{ spentCost: number; spentDurationMs: number }>;

export type RuntimeActionRecord = Readonly<ExecutionAction & {
  allowed: boolean;
  recordedAtMs: number;
  driftType: string | null;
}>;



export type OpponentIndependentStartProof = Readonly<{
  eventId: string;
  sequence: number;
  taskId: string;
  assignmentId: string;
  opponentId: string;
  sharedContextRefs: readonly string[];
  privateSolverContextExcluded: true;
  initialChallengePosition: string;
  startingSha: string;
  currentSha: string;
}>;

export type SolverResultDisclosureProof = Readonly<{
  eventId: string;
  sequence: number;
  taskId: string;
  assignmentId: string;
  opponentStartEventId: string;
  currentSha: string;
}>;

export class CellRuntime {
  private readonly tasks = new Map<string, RuntimeTask>();
  private readonly candidates = new Map<string, RuntimeCandidate>();
  private readonly assignments = new Map<string, RuntimeAssignment>();
  private readonly assignmentTeams = new Map<string, RuntimeAssignmentTeam>();
  private readonly assignmentHistory = new Map<string, RuntimeAssignmentLineage[]>();
  private readonly handoffs = new Map<string, TypedHandoff>();
  private readonly progress = new Map<string, ProgressObservation[]>();
  private readonly budgets = new Map<string, RuntimeBudget>();
  private readonly actions: RuntimeActionRecord[] = [];
  private readonly claimedOperations = new Set<string>();
  private readonly clock: () => number;
  private opponentStartSequence = 0;
  private readonly opponentIndependentStarts = new Map<string, OpponentIndependentStartProof>();
  private readonly solverDisclosures = new Map<string, SolverResultDisclosureProof>();

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
    if (current.state === "RUNNING") {
      const transitioned = this.transitionTask(taskId, "CHECKPOINTED");
      const checkpointed = Object.freeze({
        ...transitioned,
        checkpointId,
      });
      this.tasks.set(taskId, checkpointed);
      return checkpointed;
    }
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

  private hasAssignment(assignmentId: string): boolean {
    return this.assignments.has(assignmentId) || this.assignmentTeams.has(assignmentId);
  }

  private assignmentTaskId(assignmentId: string): string | null {
    return this.assignments.get(assignmentId)?.taskId ??
      this.assignmentTeams.get(assignmentId)?.taskId ??
      null;
  }

  private appendAssignmentLineage(taskId: string, assignmentId: string, reason: string | null): RuntimeAssignmentLineage {
    const history=this.assignmentHistory.get(taskId)??[];
    const previousAssignmentId=history[history.length-1]?.assignmentId??null;
    const entry=Object.freeze({assignmentId,taskId,previousAssignmentId,attempt:history.length+1,reason});
    history.push(entry);
    this.assignmentHistory.set(taskId,history);
    return entry;
  }

  assignTask(taskId: string, assignment: AssignmentQuartet, liveSha: string): RuntimeAssignment {
    const task=this.getTask(taskId);
    if(task.state!=="READY") throw new Error("ASSIGNMENT_REQUIRES_READY_TASK");
    if(this.hasAssignment(assignment.assignmentId)) throw new Error("ASSIGNMENT_ALREADY_EXISTS");
    if(assignment.currentSha!==liveSha) throw new Error("ASSIGNMENT_SHA_DRIFT");
    const lineage=this.appendAssignmentLineage(taskId,assignment.assignmentId,null);
    const record=Object.freeze({
      taskId,assignment,version:0,
      previousAssignmentId:lineage.previousAssignmentId,
      attempt:lineage.attempt,
      reason:null,
    });
    this.assignments.set(assignment.assignmentId,record);
    return record;
  }

  assignTaskTeam(taskId: string, team: AssignmentTeam, liveSha: string): RuntimeAssignmentTeam {
    const task=this.getTask(taskId);
    if(task.state!=="READY") throw new Error("ASSIGNMENT_REQUIRES_READY_TASK");
    if(this.hasAssignment(team.assignmentId)) throw new Error("ASSIGNMENT_ALREADY_EXISTS");
    if(team.currentSha!==liveSha) throw new Error("ASSIGNMENT_SHA_DRIFT");
    const lineage=this.appendAssignmentLineage(taskId,team.assignmentId,null);
    const record=Object.freeze({
      taskId,team,version:0,
      previousAssignmentId:lineage.previousAssignmentId,
      attempt:lineage.attempt,
      reason:null,
    });
    this.assignmentTeams.set(team.assignmentId,record);
    return record;
  }

  reassignTask(taskId: string, assignment: AssignmentQuartet, reason: string, liveSha: string): RuntimeAssignment {
    const task=this.getTask(taskId);
    if(!["READY","FAILED","BLOCKED"].includes(task.state)) throw new Error("TASK_NOT_REASSIGNABLE");
    if(!reason.trim()) throw new Error("REASSIGNMENT_REASON_REQUIRED");
    if(this.hasAssignment(assignment.assignmentId)) throw new Error("ASSIGNMENT_ALREADY_EXISTS");
    if(assignment.currentSha!==liveSha) throw new Error("ASSIGNMENT_SHA_DRIFT");
    const history=this.assignmentHistory.get(taskId)??[];
    const prevId=history[history.length-1]?.assignmentId??null;
    const prev=prevId?this.assignments.get(prevId)?.assignment:undefined;
    if(prev && assignment.startingSha!==prev.startingSha) throw new Error("ASSIGNMENT_START_SHA_DRIFT");
    const lineage=this.appendAssignmentLineage(taskId,assignment.assignmentId,reason.trim());
    const record=Object.freeze({
      taskId,assignment,version:0,
      previousAssignmentId:lineage.previousAssignmentId,
      attempt:lineage.attempt,
      reason:reason.trim(),
    });
    this.assignments.set(assignment.assignmentId,record);
    return record;
  }

  reassignTaskTeam(taskId: string, team: AssignmentTeam, reason: string, liveSha: string): RuntimeAssignmentTeam {
    const task=this.getTask(taskId);
    if(!["READY","FAILED","BLOCKED"].includes(task.state)) throw new Error("TASK_NOT_REASSIGNABLE");
    if(!reason.trim()) throw new Error("REASSIGNMENT_REASON_REQUIRED");
    if(this.hasAssignment(team.assignmentId)) throw new Error("ASSIGNMENT_ALREADY_EXISTS");
    if(team.currentSha!==liveSha) throw new Error("ASSIGNMENT_SHA_DRIFT");
    const history=this.assignmentHistory.get(taskId)??[];
    const prevId=history[history.length-1]?.assignmentId??null;
    const prev=prevId
      ? this.assignments.get(prevId)?.assignment ?? this.assignmentTeams.get(prevId)?.team
      : undefined;
    if(prev && team.startingSha!==prev.startingSha) throw new Error("ASSIGNMENT_START_SHA_DRIFT");
    const lineage=this.appendAssignmentLineage(taskId,team.assignmentId,reason.trim());
    const record=Object.freeze({
      taskId,team,version:0,
      previousAssignmentId:lineage.previousAssignmentId,
      attempt:lineage.attempt,
      reason:reason.trim(),
    });
    this.assignmentTeams.set(team.assignmentId,record);
    return record;
  }

  getAssignmentHistory(taskId: string): readonly RuntimeAssignmentLineage[] {
    return Object.freeze([...(this.assignmentHistory.get(taskId)??[])]);
  }

  getAssignment(assignmentId: string): RuntimeAssignment {
    const assignment=this.assignments.get(assignmentId);
    if(!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");
    return assignment;
  }

  createHandoff(handoff: TypedHandoff, liveSha: string): TypedHandoff {
    validateTypedHandoff(handoff);
    if(!this.hasAssignment(handoff.assignmentId)) throw new Error("HANDOFF_ASSIGNMENT_NOT_FOUND");
    if(this.assignmentTaskId(handoff.assignmentId)!==handoff.taskId) throw new Error("HANDOFF_TASK_MISMATCH");
    const assignment=this.assignments.get(handoff.assignmentId)?.assignment ?? this.assignmentTeams.get(handoff.assignmentId)?.team;
    if(!assignment) throw new Error("HANDOFF_ASSIGNMENT_NOT_FOUND");
    if(handoff.startingSha!==assignment.startingSha||handoff.currentSha!==assignment.currentSha) throw new Error("HANDOFF_ASSIGNMENT_SHA_MISMATCH");
    if(handoff.currentSha!==liveSha) throw new Error("HANDOFF_SHA_DRIFT");
    if(this.handoffs.has(handoff.handoffId)) throw new Error("HANDOFF_ALREADY_EXISTS");
    const stored=Object.freeze({...handoff});
    this.handoffs.set(handoff.handoffId,stored);
    return stored;
  }

  delegateHandoff(handoff: TypedHandoff, liveSha: string, rules: readonly DelegationRule[], request: DelegationRequest): TypedHandoff {
    if(handoff.currentSha!==liveSha) throw new Error("HANDOFF_SHA_DRIFT");
    const delegated=delegateHandoff(rules,request,handoff);
    return this.createHandoff(delegated,liveSha);
  }

  startOpponentIndependently(input: Readonly<{
    taskId: string;
    assignmentId: string;
    opponentId: string;
    sharedContextRefs: readonly string[];
    initialChallengePosition: string;
    liveSha: string;
  }>): OpponentIndependentStartProof {
    if (input.sharedContextRefs.length === 0 || input.sharedContextRefs.some((ref) => !ref.trim())) {
      throw new Error("OPPONENT_SHARED_CONTEXT_REQUIRED");
    }
    if (!input.initialChallengePosition.trim()) {
      throw new Error("OPPONENT_INITIAL_CHALLENGE_REQUIRED");
    }

    const team = this.assignmentTeams.get(input.assignmentId)?.team;
    if (!team || this.assignmentTaskId(input.assignmentId) !== input.taskId) {
      throw new Error("OPPONENT_ASSIGNMENT_NOT_FOUND");
    }
    if (team.opponentAgentId !== input.opponentId) {
      throw new Error("OPPONENT_ID_MISMATCH");
    }
    if (team.currentSha !== input.liveSha) {
      throw new Error("OPPONENT_START_SHA_DRIFT");
    }
    if (this.opponentIndependentStarts.has(input.assignmentId)) {
      throw new Error("OPPONENT_INDEPENDENT_START_ALREADY_RECORDED");
    }

    const sequence = ++this.opponentStartSequence;
    const proof = Object.freeze({
      eventId: \`OPPONENT-START-\${input.taskId}-\${sequence}\`,
      sequence,
      taskId: input.taskId,
      assignmentId: input.assignmentId,
      opponentId: input.opponentId,
      sharedContextRefs: Object.freeze([...input.sharedContextRefs]),
      privateSolverContextExcluded: true as const,
      initialChallengePosition: input.initialChallengePosition.trim(),
      startingSha: team.startingSha,
      currentSha: team.currentSha,
    });

    this.opponentIndependentStarts.set(input.assignmentId, proof);
    return proof;
  }

  getOpponentIndependentStart(assignmentId: string): OpponentIndependentStartProof {
    const proof = this.opponentIndependentStarts.get(assignmentId);
    if (!proof) throw new Error("OPPONENT_INDEPENDENT_START_NOT_FOUND");
    return proof;
  }

  recordSolverResultDisclosure(input: Readonly<{
    taskId: string;
    assignmentId: string;
    liveSha: string;
  }>): SolverResultDisclosureProof {
    const start = this.opponentIndependentStarts.get(input.assignmentId);
    if (!start || start.taskId !== input.taskId) {
      throw new Error("OPPONENT_INDEPENDENT_START_REQUIRED");
    }
    if (start.currentSha !== input.liveSha) {
      throw new Error("SOLVER_DISCLOSURE_SHA_DRIFT");
    }
    if (this.solverDisclosures.has(input.assignmentId)) {
      throw new Error("SOLVER_DISCLOSURE_ALREADY_RECORDED");
    }

    const sequence = ++this.opponentStartSequence;
    const proof = Object.freeze({
      eventId: \`SOLVER-DISCLOSURE-\${input.taskId}-\${sequence}\`,
      sequence,
      taskId: input.taskId,
      assignmentId: input.assignmentId,
      opponentStartEventId: start.eventId,
      currentSha: input.liveSha,
    });

    this.solverDisclosures.set(input.assignmentId, proof);
    return proof;
  }

  getSolverResultDisclosure(assignmentId: string): SolverResultDisclosureProof {
    const proof = this.solverDisclosures.get(assignmentId);
    if (!proof) throw new Error("SOLVER_DISCLOSURE_NOT_FOUND");
    return proof;
  }

  acquireAssignmentLease(
    taskId: string,
    assignmentId: string,
    ownerId: string,
    token: string,
    ttlMs: number,
    liveSha: string,
  ): RuntimeAssignmentLease {
    if(this.assignmentTaskId(assignmentId)!==taskId) throw new Error("ASSIGNMENT_NOT_FOUND");
    const assignment=this.assignments.get(assignmentId)?.assignment ?? this.assignmentTeams.get(assignmentId)?.team;
    if(!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");
    if(assignment.currentSha!==liveSha) throw new Error("ASSIGNMENT_SHA_DRIFT");
    const lease=this.acquireTaskLease(taskId,ownerId,token,ttlMs);
    return Object.freeze({assignmentId,taskId,startingSha:assignment.startingSha,currentSha:assignment.currentSha,lease});
  }

  releaseAssignmentLease(taskId: string,assignmentId: string,ownerId: string,token: string): RuntimeTask {
    if(this.assignmentTaskId(assignmentId)!==taskId) throw new Error("ASSIGNMENT_NOT_FOUND");
    return this.releaseTaskLease(taskId,ownerId,token);
  }

  authorizeIdentity(envelope: ExecutionEnvelope, probe: ExecutionIdentityProbe, liveSha: string): void {
    if (probe.currentSha !== liveSha) throw new Error("CURRENT_SHA_MISMATCH");
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