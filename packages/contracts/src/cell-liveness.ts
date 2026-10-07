import type { TaskState } from "./cell-control-plane";

export const CELL_HEARTBEAT_INTERVAL_MS = 60_000;
export const CELL_WORKER_WINDOW_MS = 45 * 60_000;
const TERMINAL_STATES = new Set<TaskState>(["PROMOTED", "ABANDONED"]);

export type CellLivenessTaskRecord = Readonly<{
  taskId: string;
  state: TaskState;
  version: number;
  checkpointId: string | null;
  currentSha: string | null;
  progressPercent: number;
  lastProgressAtMs: number | null;
  lastEvidenceAtMs: number | null;
}>;

export type CellLivenessSnapshot = Readonly<{
  schemaVersion: 1;
  workerGeneration: number;
  workerId: string | null;
  workerStartedAtMs: number | null;
  workerDeadlineAtMs: number | null;
  lastHeartbeatAtMs: number | null;
  nextHeartbeatAtMs: number | null;
  lastWorkerEndAtMs: number | null;
  lastWorkerEndReason: "window-expired" | "stopped" | null;
  lastError: string | null;
  updatedAtMs: number;
  tasks: readonly CellLivenessTaskRecord[];
}>;

export interface CellLivenessStore {
  read(): CellLivenessSnapshot | null;
  write(snapshot: CellLivenessSnapshot): void;
}

export class InMemoryCellLivenessStore implements CellLivenessStore {
  private value: CellLivenessSnapshot | null = null;
  read(): CellLivenessSnapshot | null { return this.value; }
  write(snapshot: CellLivenessSnapshot): void { this.value = snapshot; }
}

export type CellWakeHandler = (
  reason: "initial" | "worker-window-expired" | "recovery",
  generation: number,
  atMs: number,
) => string;

export type CellHeartbeatHandler = (workerId: string, atMs: number) => void;

export type CellLivenessOptions = Readonly<{
  clock?: () => number;
  store?: CellLivenessStore;
  onWake?: CellWakeHandler;
  onHeartbeat?: CellHeartbeatHandler;
  heartbeatIntervalMs?: number;
  workerWindowMs?: number;
}>;

export type CellWorkerStatus = Readonly<{
  workerId: string | null;
  generation: number;
  startedAtMs: number | null;
  deadlineAtMs: number | null;
  lastHeartbeatAtMs: number | null;
  nextHeartbeatAtMs: number | null;
  lastWorkerEndAtMs: number | null;
  lastWorkerEndReason: "window-expired" | "stopped" | null;
}>;

function positiveInteger(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 1 || !Number.isInteger(value)) {
    throw new Error(name + " must be a positive integer.");
  }
  return value;
}
function freezeTask(task: CellLivenessTaskRecord): CellLivenessTaskRecord {
  return Object.freeze({ ...task });
}
function freezeSnapshot(snapshot: CellLivenessSnapshot): CellLivenessSnapshot {
  return Object.freeze({ ...snapshot, tasks: Object.freeze(snapshot.tasks.map(freezeTask)) });
}
function restoreSnapshot(value: CellLivenessSnapshot | null): CellLivenessSnapshot | null {
  if (!value) return null;
  if (value.schemaVersion !== 1 || !Array.isArray(value.tasks)) throw new Error("CELL_LIVENESS_SNAPSHOT_INVALID");
  return freezeSnapshot(value);
}

export class CellLivenessRuntime {
  private readonly clock: () => number;
  private readonly store: CellLivenessStore;
  private readonly onWake?: CellWakeHandler;
  private readonly onHeartbeat?: CellHeartbeatHandler;
  private readonly heartbeatIntervalMs: number;
  private readonly workerWindowMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private workerGeneration = 0;
  private workerId: string | null = null;
  private workerStartedAtMs: number | null = null;
  private workerDeadlineAtMs: number | null = null;
  private lastHeartbeatAtMs: number | null = null;
  private nextHeartbeatAtMs: number | null = null;
  private lastWorkerEndAtMs: number | null = null;
  private lastWorkerEndReason: "window-expired" | "stopped" | null = null;
  private lastError: string | null = null;
  private updatedAtMs: number;
  private readonly tasks = new Map<string, CellLivenessTaskRecord>();

  constructor(options: CellLivenessOptions = {}) {
    this.clock = options.clock ?? (() => Date.now());
    this.store = options.store ?? new InMemoryCellLivenessStore();
    this.onWake = options.onWake;
    this.onHeartbeat = options.onHeartbeat;
    this.heartbeatIntervalMs = positiveInteger(options.heartbeatIntervalMs ?? CELL_HEARTBEAT_INTERVAL_MS, "CELL heartbeat interval");
    this.workerWindowMs = positiveInteger(options.workerWindowMs ?? CELL_WORKER_WINDOW_MS, "CELL worker window");
    const restored = restoreSnapshot(this.store.read());
    if (restored) {
      this.workerGeneration = restored.workerGeneration;
      this.workerId = restored.workerId;
      this.workerStartedAtMs = restored.workerStartedAtMs;
      this.workerDeadlineAtMs = restored.workerDeadlineAtMs;
      this.lastHeartbeatAtMs = restored.lastHeartbeatAtMs;
      this.nextHeartbeatAtMs = restored.nextHeartbeatAtMs;
      this.lastWorkerEndAtMs = restored.lastWorkerEndAtMs;
      this.lastWorkerEndReason = restored.lastWorkerEndReason;
      this.lastError = restored.lastError;
      this.updatedAtMs = restored.updatedAtMs;
      for (const task of restored.tasks) this.tasks.set(task.taskId, freezeTask(task));
    } else {
      this.updatedAtMs = this.clock();
      this.persist();
    }
  }

  observeTask(input: Readonly<{
    taskId: string;
    state: TaskState;
    version: number;
    checkpointId: string | null;
    currentSha?: string | null;
  }>): CellLivenessTaskRecord {
    if (!input.taskId.trim()) throw new Error("CELL_LIVENESS_TASK_ID_REQUIRED");
    if (!Number.isInteger(input.version) || input.version < 0) throw new Error("CELL_LIVENESS_TASK_VERSION_INVALID");
    const previous = this.tasks.get(input.taskId);
    const task = freezeTask({
      taskId: input.taskId,
      state: input.state,
      version: input.version,
      checkpointId: input.checkpointId,
      currentSha: input.currentSha ?? previous?.currentSha ?? null,
      progressPercent: previous?.progressPercent ?? 0,
      lastProgressAtMs: previous?.lastProgressAtMs ?? null,
      lastEvidenceAtMs: previous?.lastEvidenceAtMs ?? null,
    });
    this.tasks.set(input.taskId, task);
    this.persist();
    return task;
  }

  recordProgress(taskId: string, progressPercent: number, observedAtMs: number, lastEvidenceAtMs: number | null): CellLivenessTaskRecord {
    const current = this.tasks.get(taskId);
    if (!current) throw new Error("CELL_LIVENESS_TASK_NOT_FOUND");
    if (!Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100) throw new Error("CELL_LIVENESS_PROGRESS_INVALID");
    if (!Number.isFinite(observedAtMs) || observedAtMs < 0) throw new Error("CELL_LIVENESS_PROGRESS_TIME_INVALID");
    const task = freezeTask({ ...current, progressPercent, lastProgressAtMs: observedAtMs, lastEvidenceAtMs });
    this.tasks.set(taskId, task);
    this.persist();
    return task;
  }

  startWorker(workerId: string, atMs = this.clock()): CellWorkerStatus {
    if (!workerId.trim()) throw new Error("CELL_WORKER_ID_REQUIRED");
    if (this.workerId && this.workerDeadlineAtMs !== null && atMs < this.workerDeadlineAtMs) throw new Error("CELL_WORKER_ALREADY_ACTIVE");
    this.workerGeneration += 1;
    this.workerId = workerId;
    this.workerStartedAtMs = atMs;
    this.workerDeadlineAtMs = atMs + this.workerWindowMs;
    this.lastHeartbeatAtMs = atMs;
    this.nextHeartbeatAtMs = atMs + this.heartbeatIntervalMs;
    this.lastWorkerEndReason = null;
    this.lastError = null;
    this.persist(atMs);
    this.onHeartbeat?.(workerId, atMs);
    return this.workerStatus();
  }

  heartbeat(workerId: string, atMs = this.clock()): CellWorkerStatus {
    if (!this.workerId || workerId !== this.workerId) throw new Error("CELL_HEARTBEAT_WORKER_MISMATCH");
    if (this.workerDeadlineAtMs === null || atMs >= this.workerDeadlineAtMs) throw new Error("CELL_WORKER_WINDOW_EXPIRED");
    this.lastHeartbeatAtMs = atMs;
    this.nextHeartbeatAtMs = atMs + this.heartbeatIntervalMs;
    this.lastError = null;
    this.persist(atMs);
    this.onHeartbeat?.(workerId, atMs);
    return this.workerStatus();
  }

  endWorker(reason: "window-expired" | "stopped" = "stopped", atMs = this.clock()): void {
    if (this.workerId) {
      this.lastWorkerEndAtMs = atMs;
      this.lastWorkerEndReason = reason;
    }
    this.workerId = null;
    this.workerStartedAtMs = null;
    this.workerDeadlineAtMs = null;
    this.lastHeartbeatAtMs = null;
    this.nextHeartbeatAtMs = null;
    this.persist(atMs);
  }

  tick(atMs = this.clock()): CellLivenessSnapshot {
    if (!Number.isFinite(atMs) || atMs < 0) throw new Error("CELL_LIVENESS_CLOCK_INVALID");
    if (this.workerId && this.workerDeadlineAtMs !== null && atMs >= this.workerDeadlineAtMs) this.endWorker("window-expired", atMs);
    if (!this.workerId) {
      const reason = this.workerGeneration === 0 ? "initial" : "recovery";
      if (!this.onWake) throw new Error("CELL_WAKE_HANDLER_REQUIRED");
      const nextWorkerId = this.onWake(reason, this.workerGeneration + 1, atMs);
      if (!nextWorkerId?.trim()) throw new Error("CELL_WAKE_HANDLER_INVALID");
      this.startWorker(nextWorkerId, atMs);
    } else if (this.nextHeartbeatAtMs !== null && atMs >= this.nextHeartbeatAtMs) {
      this.heartbeat(this.workerId, atMs);
    }
    this.lastError = null;
    this.persist(atMs);
    return this.snapshot();
  }

  start(): void {
    if (this.timer) return;
    try { this.tick(this.clock()); }
    catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.persist(this.clock());
    }
    this.timer = setInterval(() => {
      try { this.tick(this.clock()); }
      catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
        this.persist(this.clock());
      }
    }, this.heartbeatIntervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.persist(this.clock());
  }

  getOpenTasks(): readonly CellLivenessTaskRecord[] {
    return Object.freeze([...this.tasks.values()].filter((task) => !TERMINAL_STATES.has(task.state)).map(freezeTask));
  }

  workerStatus(): CellWorkerStatus {
    return Object.freeze({
      workerId: this.workerId,
      generation: this.workerGeneration,
      startedAtMs: this.workerStartedAtMs,
      deadlineAtMs: this.workerDeadlineAtMs,
      lastHeartbeatAtMs: this.lastHeartbeatAtMs,
      nextHeartbeatAtMs: this.nextHeartbeatAtMs,
      lastWorkerEndAtMs: this.lastWorkerEndAtMs,
      lastWorkerEndReason: this.lastWorkerEndReason,
    });
  }

  snapshot(): CellLivenessSnapshot {
    return freezeSnapshot({
      schemaVersion: 1,
      workerGeneration: this.workerGeneration,
      workerId: this.workerId,
      workerStartedAtMs: this.workerStartedAtMs,
      workerDeadlineAtMs: this.workerDeadlineAtMs,
      lastHeartbeatAtMs: this.lastHeartbeatAtMs,
      nextHeartbeatAtMs: this.nextHeartbeatAtMs,
      lastWorkerEndAtMs: this.lastWorkerEndAtMs,
      lastWorkerEndReason: this.lastWorkerEndReason,
      lastError: this.lastError,
      updatedAtMs: this.updatedAtMs,
      tasks: [...this.tasks.values()],
    });
  }

  private persist(atMs = this.clock()): void {
    this.updatedAtMs = atMs;
    this.store.write(this.snapshot());
  }
}
