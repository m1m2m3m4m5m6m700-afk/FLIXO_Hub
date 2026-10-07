const SHA = {
  start: "1111111111111111111111111111111111111111",
  current: "2222222222222222222222222222222222222222",
  stale: "3333333333333333333333333333333333333333",
} as const;


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
    startingSha: SHA.start,
    currentSha: SHA.current,
  };

  const assigned = rt.assignTask("t-assignment", assignment, SHA.current);
  assert.equal(assigned.assignment.assignmentId, "as-1");
  assert.equal(ready.state, "READY");

  const handoff = {
    handoffId: "h-1",
    missionId: "mission-1",
    sessionId: "session-1",
    taskId: "t-assignment",
    parentTaskId: null,
    assignmentId: "as-1",
    sourceAgentId: "agent-a",
    targetAgentId: "agent-c",
    taskType: "VERIFY",
    riskClass: "HIGH",
    reason: "independent verification",
    objective: "produce counterexample",
    inputRefs: ["candidate:c1"],
    requiredCapabilities: ["falsification"],
    expectedOutput: "COUNTEREXAMPLE",
    verificationCriteria: ["exact SHA evidence"],
    readScope: "tests/**",
    writeScope: "reports/**",
    startingSha: SHA.start,
    currentSha: SHA.current,
    deadlineAtMs: null,
    budget: { cost: 1, durationMs: 1000 },
    evidenceRequirements: ["exact SHA"],
    returnContract: "return evidence refs",
  };

  assert.equal(rt.createHandoff(handoff, SHA.current).handoffId, "h-1");

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

test("runtime preserves native solver-opponent assignment lineage", () => {
  const rt = new CellRuntime(() => 1000);
  const created = rt.registerTask("t-team");
  const ready = rt.transitionTask("t-team", "READY", created.version);
  assert.equal(ready.state, "READY");
  const team = {
    assignmentId: "team-1",
    solverAgentId: "agent-a",
    backupSolverAgentId: "agent-b",
    opponentAgentId: "agent-c",
    backupOpponentAgentId: null,
    verifierAgentId: "agent-d",
    escalationTargetAgentId: null,
    startingSha: SHA.start,
    currentSha: SHA.current,
  };
  assert.equal(rt.assignTaskTeam("t-team", team, SHA.current).team.opponentAgentId, "agent-c");
});

test("assignment SHA drift and typed handoff task mismatch are rejected", () => {
  const rt = new CellRuntime(() => 1000);
  rt.registerTask("t");
  rt.transitionTask("t", "READY");
  const assignment = {
    assignmentId: "a1",
    primaryAgentId: "p",
    backupAgentId: "b",
    verifierAgentId: null,
    escalationTargetAgentId: null,
    startingSha: SHA.start,
    currentSha: SHA.current,
  };
  assert.throws(() => rt.assignTask("t", { ...assignment, currentSha: SHA.stale }, SHA.current), /ASSIGNMENT_SHA_DRIFT/);
  rt.assignTask("t", assignment, SHA.current);
  const handoff = {
    handoffId: "h",
    missionId: "m",
    sessionId: "s",
    taskId: "other",
    parentTaskId: null,
    assignmentId: "a1",
    sourceAgentId: "p",
    targetAgentId: "b",
    taskType: "VERIFY",
    riskClass: "LOW",
    reason: "handoff",
    objective: "verify",
    inputRefs: ["candidate:c"],
    requiredCapabilities: ["verification"],
    expectedOutput: "evidence",
    verificationCriteria: ["exact SHA"],
    readScope: "tests/**",
    writeScope: "reports/**",
    startingSha: SHA.start,
    currentSha: SHA.current,
    deadlineAtMs: null,
    budget: { cost: 1, durationMs: 100 },
    evidenceRequirements: ["exact SHA"],
    returnContract: "return refs",
  };
  assert.throws(() => rt.createHandoff(handoff, SHA.current), /HANDOFF_TASK_MISMATCH/);
});

test("reassignment preserves task lineage and assignment attempt", () => {
  const rt = new CellRuntime(() => 1000);
  const t = rt.registerTask("t-swap");
  rt.transitionTask("t-swap", "READY", t.version);
  const first = {
    assignmentId: "a1",
    primaryAgentId: "agent-a",
    backupAgentId: "agent-b",
    verifierAgentId: null,
    escalationTargetAgentId: null,
    startingSha: SHA.start,
    currentSha: SHA.current,
  };
  rt.assignTask("t-swap", first, SHA.current);
  rt.transitionTask("t-swap", "CLAIMED");
  rt.transitionTask("t-swap", "RUNNING");
  rt.transitionTask("t-swap", "FAILED");
  const second = rt.reassignTask("t-swap", { ...first, assignmentId: "a2", primaryAgentId: "agent-b", backupAgentId: "agent-a" }, "solver stalled", SHA.current);
  assert.equal(second.taskId, "t-swap");
  assert.equal(second.previousAssignmentId, "a1");
  assert.equal(second.attempt, 2);
  assert.deepEqual(rt.getAssignmentHistory("t-swap").map((x) => [x.assignmentId, x.previousAssignmentId]), [["a1", null], ["a2", "a1"]]);
});

test("reassignment preserves team lineage", () => {
  const rt = new CellRuntime(() => 1000);
  rt.registerTask("t-team-swap");
  rt.transitionTask("t-team-swap", "READY");
  const first = {
    assignmentId: "team-1",
    solverAgentId: "agent-a",
    backupSolverAgentId: "agent-b",
    opponentAgentId: "agent-c",
    backupOpponentAgentId: null,
    verifierAgentId: null,
    escalationTargetAgentId: "agent-d",
    startingSha: SHA.start,
    currentSha: SHA.current,
  };
  rt.assignTaskTeam("t-team-swap", first, SHA.current);
  const second = {
    ...first,
    assignmentId: "team-2",
    solverAgentId: "agent-b",
    backupSolverAgentId: "agent-a",
  };
  const reassigned = rt.reassignTaskTeam(
    "t-team-swap",
    second,
    "opponent workflow stalled",
    SHA.current,
  );
  assert.equal(reassigned.previousAssignmentId, "team-1");
  assert.equal(reassigned.attempt, 2);
  assert.equal(reassigned.reason, "opponent workflow stalled");
  assert.deepEqual(
    rt.getAssignmentHistory("t-team-swap"),
    [
      { assignmentId: "team-1", taskId: "t-team-swap", previousAssignmentId: null, attempt: 1, reason: null },
      { assignmentId: "team-2", taskId: "t-team-swap", previousAssignmentId: "team-1", attempt: 2, reason: "opponent workflow stalled" },
    ],
  );
});

test("assignment-linked lease is bound to assignment and exact SHA", () => {
  const rt = new CellRuntime(() => 1000);
  rt.registerTask("t-lease");
  rt.transitionTask("t-lease", "READY");
  const assignment = {
    assignmentId: "a1",
    primaryAgentId: "a",
    backupAgentId: "b",
    verifierAgentId: null,
    escalationTargetAgentId: null,
    startingSha: SHA.start,
    currentSha: SHA.current,
  };
  rt.assignTask("t-lease", assignment, SHA.current);
  const lease = rt.acquireAssignmentLease("t-lease", "a1", "a", "l", 100, SHA.current);
  assert.equal(lease.assignmentId, "a1");
  assert.equal(lease.startingSha, SHA.start);
  assert.throws(() => rt.acquireAssignmentLease("t-lease", "a1", "a", "l2", 100, SHA.stale), /ASSIGNMENT_SHA_DRIFT/);
  rt.releaseAssignmentLease("t-lease", "a1", "a", "l");
});

test("delegation is denied when edge is absent and accepted when typed", () => {
  const rt = new CellRuntime(() => 1000);
  rt.registerTask("t-del");
  rt.transitionTask("t-del", "READY");
  rt.assignTask("t-del", {
    assignmentId: "a-del",
    primaryAgentId: "a",
    backupAgentId: "b",
    verifierAgentId: null,
    escalationTargetAgentId: null,
    startingSha: SHA.start,
    currentSha: SHA.current,
  }, SHA.current);
  const h = {
    handoffId: "h-del",
    missionId: "m",
    sessionId: "s",
    taskId: "t-del",
    parentTaskId: null,
    assignmentId: "a-del",
    sourceAgentId: "a",
    targetAgentId: "b",
    taskType: "VERIFY",
    riskClass: "HIGH",
    reason: "verify",
    objective: "verify",
    inputRefs: ["candidate:c"],
    requiredCapabilities: ["verification"],
    expectedOutput: "evidence",
    verificationCriteria: ["exact SHA"],
    readScope: "tests/**",
    writeScope: "reports/**",
    startingSha: SHA.start,
    currentSha: SHA.current,
    deadlineAtMs: null,
    budget: { cost: 1, durationMs: 100 },
    evidenceRequirements: ["exact SHA"],
    returnContract: "return refs",
  };
  const request = {
    taskId: "t-del",
    sourceAgentId: "a",
    targetAgentId: "b",
    taskType: "VERIFY",
    riskClass: "HIGH",
    depth: 1,
    activeSubtasks: 1,
    estimatedCost: 1,
    estimatedDurationMs: 100,
  };
  const rule = {
    sourceAgentId: "a",
    targetAgentId: "b",
    taskTypes: ["VERIFY"],
    riskClasses: ["HIGH"],
    maxDepth: 1,
    maxActiveSubtasks: 1,
    maxCost: 1,
    maxDurationMs: 100,
  };
  assert.throws(() => rt.delegateHandoff(h, SHA.current, [], request), /DELEGATION_REJECTED/);
  assert.equal(rt.delegateHandoff(h, SHA.current, [rule], request).handoffId, "h-del");
});
