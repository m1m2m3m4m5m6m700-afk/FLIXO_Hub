
import assert from "node:assert/strict";
import test from "node:test";
import { CellRuntime } from "../../packages/contracts/src/cell-runtime.ts";
import { isLeaseLive } from "../../packages/contracts/src/cell-control-plane.ts";

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

test("checkpoint cannot be created before task execution", () => {
  const rt = new CellRuntime(() => 1000);
  rt.registerTask("t1");
  assert.throws(() => rt.checkpointTask("t1", "cp-before-run"), /CHECKPOINT_NOT_ALLOWED/);
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
  const created = rt.registerCandidate("c1");
  rt.transitionCandidate("c1", "PROMISING", created.version);
  rt.transitionCandidate("c1", "SELECTED");
  rt.transitionCandidate("c1", "CERTIFIED");
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


test("lease is not live before its acquisition instant", () => {
  const lease = { ownerId: "a1", token: "l1", acquiredAtMs: 1000, expiresAtMs: 1100 };
  assert.equal(isLeaseLive(lease, 999), false);
  assert.equal(isLeaseLive(lease, 1000), true);
  assert.equal(isLeaseLive(lease, 1100), false);
});

test("reference runtime carries assignment, typed handoff and progress decisions", () => {
  const rt = new CellRuntime(() => 1000);
  const task = rt.registerTask("t-assignment");
  const ready = rt.transitionTask("t-assignment", "READY", task.version);
  rt.transitionTask("t-assignment", "CLAIMED", ready.version);
  rt.transitionTask("t-assignment", "RUNNING");

  const assignment = {
    assignmentId: "as-1",
    primaryAgentId: "agent-a",
    backupAgentId: "agent-b",
    verifierAgentId: "agent-c",
    escalationTargetAgentId: "agent-d",
  };

  const assigned = rt.assignTask("t-assignment", assignment);
  assert.equal(assigned.assignment.assignmentId, "as-1");
  assert.equal(ready.state, "READY");

  const handoff = {
    handoffId: "h-1",
    taskId: "t-assignment",
    parentTaskId: null,
    assignmentId: "as-1",
    sourceAgentId: "agent-a",
    targetAgentId: "agent-c",
    reason: "independent verification",
    objective: "produce counterexample",
    inputRefs: ["candidate:c1"],
    requiredCapabilities: ["falsification"],
    expectedOutput: "COUNTEREXAMPLE",
    verificationCriteria: ["exact SHA evidence"],
    readScope: "tests/**",
    writeScope: "reports/**",
    currentSha: "sha-a",
    deadlineAtMs: null,
    budget: { cost: 1, durationMs: 1000 },
    evidenceRequirements: ["exact SHA"],
    returnContract: "return evidence refs",
  };

  assert.equal(rt.createHandoff(handoff).handoffId, "h-1");

  const decision = rt.recordProgress({
    taskId: "t-assignment",
    assignmentId: "as-1",
    agentId: "agent-a",
    observedAtMs: 1000,
    progressPercent: 0,
    usefulOutputCount: 0,
    lastEvidenceAtMs: null,
    state: "ON_TRACK",
    blocker: null,
    nextAction: "begin",
  });
  assert.equal(decision, "CONTINUE");
});
