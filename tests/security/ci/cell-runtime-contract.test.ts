
import assert from "node:assert/strict";
import test from "node:test";
import { CellRuntime } from "../../packages/contracts/src/cell-runtime.ts";

test("reference runtime prevents illegal task transitions and detects version conflicts", () => {
  const rt = new CellRuntime(() => 1000);
  rt.registerTask("t1");
  const ready = rt.transitionTask("t1", "READY");
  assert.throws(() => rt.transitionTask("t1", "PROMOTED"), /INVALID_TASK_TRANSITION/);
  assert.throws(() => rt.transitionTask("t1", "CLAIMED", ready.version - 1), /TASK_VERSION_CONFLICT/);
});

test("lease acquisition is exclusive and release requires ownership", () => {
  const rt = new CellRuntime(() => 1000);
  rt.registerTask("t1");
  const lease = rt.acquireTaskLease("t1", "a1", "l1", 100);
  assert.throws(() => rt.acquireTaskLease("t1", "a2", "l2", 100), /LEASE_ALREADY_HELD/);
  assert.throws(() => rt.releaseTaskLease("t1", "a2", "l1"), /STALE_OR_INVALID_LEASE/);
  assert.equal(rt.releaseTaskLease("t1", lease.ownerId, lease.token).lease, null);
});

test("checkpoint is persisted before verification transition", () => {
  const rt = new CellRuntime(() => 1000);
  rt.registerTask("t1");
  rt.transitionTask("t1", "READY");
  rt.transitionTask("t1", "CLAIMED");
  rt.transitionTask("t1", "RUNNING");
  const checkpointed = rt.checkpointTask("t1", "cp-1");
  assert.equal(checkpointed.state, "CHECKPOINTED");
  assert.equal(checkpointed.checkpointId, "cp-1");
});

test("duplicate recovery/execution key is idempotently rejected", () => {
  const rt = new CellRuntime();
  assert.equal(rt.claimIdempotentOperation("wake:t1"), true);
  assert.equal(rt.claimIdempotentOperation("wake:t1"), false);
});

test("candidate promotion is impossible before exact certification lineage", () => {
  const rt = new CellRuntime();
  rt.registerCandidate("c1", "CERTIFIED");
  const good = {
    candidateState: "CERTIFIED" as const,
    testedSha: "sha-a",
    runtimeSha: "sha-a",
    certifiedSha: "sha-a",
    redTeam: "PASS" as const,
    opponent: "PASS" as const,
    certification: "PASS" as const,
  };
  assert.throws(() => rt.promoteCandidate("c1", { ...good, certification: "FAIL" }, "sha-a"), /PROMOTION_DENIED/);
  assert.equal(rt.promoteCandidate("c1", good, "sha-a").state, "PROMOTED");
});
