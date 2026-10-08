import assert from "node:assert/strict";
import test from "node:test";
import { CELL_HEARTBEAT_INTERVAL_MS, CELL_WORKER_WINDOW_MS, CellLivenessRuntime, InMemoryCellLivenessStore } from "../../packages/contracts/src/cell-liveness.ts";

test("CELL emits 60-second heartbeats and never transitions an open task to sleep/idle", () => {
  const now = 0;
  const beats: number[] = [];
  const wakes: string[] = [];
  const live = new CellLivenessRuntime({
    clock: () => now,
    store: new InMemoryCellLivenessStore(),
    onWake: (_r, g) => { const id = "worker-" + g; wakes.push(id); return id; },
    onHeartbeat: (_w, at) => beats.push(at),
  });
  live.observeTask({ taskId: "open", state: "RUNNING", version: 1, checkpointId: null });
  live.tick();
  now = CELL_HEARTBEAT_INTERVAL_MS; live.tick();
  now = 2 * CELL_HEARTBEAT_INTERVAL_MS; live.tick();
  assert.deepEqual(beats, [0, 60_000, 120_000]);
  assert.deepEqual(wakes, ["worker-1"]);
  assert.equal(live.getOpenTasks()[0]?.state, "RUNNING");
});

test("45-minute worker expiry automatically wakes the next worker and preserves checkpoint/progress", () => {
  const now = 0;
  const store = new InMemoryCellLivenessStore();
  const reasons: string[] = [];
  const live = new CellLivenessRuntime({
    clock: () => now,
    store,
    onWake: (reason, generation) => { reasons.push(reason); return "worker-" + generation; },
  });
  live.observeTask({ taskId: "task-continuity", state: "RUNNING", version: 7, checkpointId: "cp-7", currentSha: "a".repeat(40) });
  live.recordProgress("task-continuity", 64, 0, 0);
  live.tick();
  now = CELL_WORKER_WINDOW_MS;
  live.tick();
  const snapshot = live.snapshot();
  assert.equal(snapshot.workerGeneration, 2);
  assert.equal(snapshot.lastWorkerEndReason, "window-expired");
  assert.equal(snapshot.workerId, "worker-2");
  assert.equal(snapshot.tasks[0]?.state, "RUNNING");
  assert.equal(snapshot.tasks[0]?.checkpointId, "cp-7");
  assert.equal(snapshot.tasks[0]?.progressPercent, 64);
  assert.deepEqual(reasons, ["initial", "recovery"]);
});

test("fresh runtime reloads persisted open task state without marking it failed/abandoned", () => {
  const now = 0;
  const store = new InMemoryCellLivenessStore();
  const first = new CellLivenessRuntime({ clock: () => now, store, onWake: (_r, g) => "worker-" + g });
  first.observeTask({ taskId: "recover", state: "CHECKPOINTED", version: 12, checkpointId: "cp-12", currentSha: "b".repeat(40) });
  first.recordProgress("recover", 83, 120_000, 120_000);
  const second = new CellLivenessRuntime({ clock: () => now, store, onWake: (_r, g) => "worker-" + g });
  const task = second.getOpenTasks()[0];
  assert.equal(task?.state, "CHECKPOINTED");
  assert.equal(task?.checkpointId, "cp-12");
  assert.equal(task?.progressPercent, 83);
  assert.equal(task?.version, 12);
  assert.equal(task?.currentSha, "b".repeat(40));
});
test("CellRuntime auto-starts liveness with a deterministic default worker wake", () => {
  const runtime = new CellRuntime(() => 0);
  const snapshot = runtime.getCellLivenessSnapshot();
  assert.equal(snapshot.workerId, "cell-worker-1");
  assert.equal(snapshot.workerGeneration, 1);
  assert.equal(snapshot.lastHeartbeatAtMs, 0);
  runtime.stopCellLiveness();
});

test("CellRuntime can disable auto-start for deterministic lifecycle control", () => {
  const runtime = new CellRuntime(() => 0, { autoStart: false });
  const snapshot = runtime.getCellLivenessSnapshot();
  assert.equal(snapshot.workerId, null);
  assert.equal(snapshot.workerGeneration, 0);
});
