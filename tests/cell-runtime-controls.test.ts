import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalAgentStateCanTransition,
  canonicalTaskStateCanTransition,
  validateEvidenceLineageNode,
} from "../packages/contracts/src/cell-hard-control.ts";
import { CellLivenessRuntime, InMemoryCellLivenessStore } from "../packages/contracts/src/cell-liveness.ts";

test("canonical CELL task and agent lifecycle rejects terminal or unsafe transitions", () => {
  assert.equal(canonicalTaskStateCanTransition("QUEUED", "ADMITTED"), true);
  assert.equal(canonicalTaskStateCanTransition("VERIFYING", "READY_TO_CLOSE"), true);
  assert.equal(canonicalTaskStateCanTransition("CLOSED", "QUEUED"), false);
  assert.equal(canonicalAgentStateCanTransition("WORKING", "DEGRADED"), true);
  assert.equal(canonicalAgentStateCanTransition("QUARANTINED", "WORKING"), false);
});

test("canonical CELL evidence lineage validates SHA-256 identity and freezes records", () => {
  const record = validateEvidenceLineageNode({
    id: "evidence-1",
    kind: "test",
    hash: "a".repeat(64),
    identity: "task:1",
    version: "1",
    timestamp: 100,
    parent: null,
  });
  assert.equal(Object.isFrozen(record), true);
  assert.throws(
    () => validateEvidenceLineageNode({ id: "bad", kind: "test", hash: "forged", identity: "task:1", version: "1", timestamp: 100, parent: null }),
    /UNVERIFIABLE/u,
  );
});

test("canonical CELL liveness records worker generation, rejects mismatches, and recovers after expiry", () => {
  let now = 100;
  const wakes: string[] = [];
  const store = new InMemoryCellLivenessStore();
  const runtime = new CellLivenessRuntime({
    clock: () => now,
    store,
    heartbeatIntervalMs: 10,
    workerWindowMs: 50,
    onWake: (reason, generation) => {
      const workerId = `worker-${generation}`;
      wakes.push(`${reason}:${workerId}`);
      return workerId;
    },
  });

  const started = runtime.startWorker("worker-1", now);
  assert.equal(started.generation, 1);
  assert.equal(started.deadlineAtMs, 150);
  assert.throws(() => runtime.heartbeat("other-worker", 110), /CELL_HEARTBEAT_WORKER_MISMATCH/u);

  now = 150;
  const recovered = runtime.tick(now);
  assert.equal(recovered.workerId, "worker-2");
  assert.equal(recovered.workerGeneration, 2);
  assert.equal(recovered.lastWorkerEndReason, null);
  assert.deepEqual(wakes, ["recovery:worker-2"]);
  assert.equal(store.read()?.workerId, "worker-2");
  runtime.stop();
});
