
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

export class CellRuntime {
  private readonly tasks = new Map<string, RuntimeTask>();
  private readonly candidates = new Map<string, RuntimeCandidate>();
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
    this.tasks.set(taskId, Object.freeze({ ...current, lease }));
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

  registerCandidate(candidateId: string, state: CandidateState = "CREATED"): RuntimeCandidate {
    if (!candidateId || this.candidates.has(candidateId)) throw new Error("CANDIDATE_ALREADY_REGISTERED");
    const candidate = Object.freeze({ candidateId, state, version: 0 });
    this.candidates.set(candidateId, candidate);
    return candidate;
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
