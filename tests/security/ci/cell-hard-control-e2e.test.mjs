import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  HARD_CONTROL_RUNTIME_VERSION,
  HARD_DRIFT_CODES,
  HARD_RUNTIME_REQUIRED_ASSIGNMENT_FIELDS,
  HARD_RUNTIME_TASK_STATES,
  HARD_RUNTIME_AGENT_STATES,
  HardControlRuntime,
  arbitrateHardControlConflict,
  authorizeMemoryUse,
  buildHardControlEvidenceNode,
  hardControlTestMatrix,
} from "../../../scripts/agent-control-plane.mjs";

const SHA = "a".repeat(40);
const SHA2 = "b".repeat(40);
const HASH = "c".repeat(64);

const scope = Object.freeze({
  read: ["src/**", "tests/**", "packages/contracts/src/**"],
  write: ["src/**", "tests/**", "packages/contracts/src/**"],
  branches: ["execution"],
  tools: ["cell-editor", "cell-tester"],
  resources: ["cpu"],
});

function recordEvidenceThrough(rt, through = "promotion") {
  const kinds = ["sourceSha","build","session","action","candidate","test","opponent","redTeam","verifier","certification","promotion"];
  let parent = null;
  for (const kind of kinds) {
    const node = buildHardControlEvidenceNode({
      id: "E2-" + kind,
      kind,
      identity: "CELL",
      version: HARD_CONTROL_RUNTIME_VERSION,
      timestamp: 1000 + rt.evidence.size,
      parent,
    });
    rt.recordEvidenceNode(node);
    parent = node.id;
    if (kind === through) break;
  }
}

function seed(options = {}) {
  let now = 1000;
  const rt = new HardControlRuntime({ liveSha: SHA, clock: () => now });
  const task = rt.registerTask({
    taskId: "TASK-1",
    missionId: "MISSION-1",
    requiredCapability: "CELL_EDIT",
    riskClass: options.riskClass ?? "MEDIUM",
    acceptance: "exact evidence + independent verification",
    objectiveId: "OBJ-1",
    acceptanceDigest: "ACC-1",
    startingSha: options.taskSha ?? SHA,
    scope,
  });

  const ids = ["solver", "opponent", "backup-solver", "backup-opponent", "verifier", "intruder"];
  for (const id of ids) {
    const authority = id === "solver" && options.solverAuthority
      ? options.solverAuthority
      : ["READ", "TEST", "WRITE"];
    rt.registerAgent({
      agentId: id,
      capabilities: ["CELL_EDIT"],
      authority,
      independenceKey: id,
      scope,
    });
    rt.transitionAgent(id, "READY");
  }

  const assignment = {
    assignmentId: "ASSIGN-1",
    taskId: task.taskId,
    missionId: task.missionId,
    solverId: "solver",
    opponentId: "opponent",
    backupSolverId: "backup-solver",
    backupOpponentId: "backup-opponent",
    verifierId: "verifier",
    riskClass: task.riskClass,
    oppositionPlan: "seek a counterexample independently",
    falsificationPolicy: "reject on reproducible contradiction",
    independencePolicy: "distinct principal identity and independence key",
    startingSha: task.startingSha,
    scope,
    budget: { cost: 2, durationMs: 200 },
    delegationDepth: 1,
    deadlineAt: 2000,
    handoffPolicy: "typed exact-SHA handoff",
    requiredCapability: "CELL_EDIT",
  };

  function admit(overrides = {}) {
    return rt.createAssignment({ ...assignment, ...overrides });
  }

  function session(options2 = {}) {
    const started = rt.startSession("ASSIGN-1", {
      sessionId: options2.sessionId ?? "SESSION-1",
      ttlMs: options2.ttlMs ?? 100,
    });
    rt.transitionAgent(options2.ownerId ?? "solver", "WORKING");
    return started;
  }

  function action(started, overrides = {}) {
    return {
      actionId: "ACTION-1",
      taskId: "TASK-1",
      agentId: "solver",
      sessionId: started.sessionId,
      missionId: "MISSION-1",
      branch: "execution",
      startingSha: SHA,
      currentSha: SHA,
      capability: "CELL_EDIT",
      toolId: "cell-editor",
      resource: "cpu",
      operation: "WRITE",
      path: "packages/contracts/src/cell-hard-control.ts",
      estimatedCost: 1,
      estimatedDurationMs: 100,
      leaseId: started.lease.leaseId,
      fenceToken: started.lease.fenceToken,
      idempotencyKey: "KEY-1",
      ...overrides,
    };
  }

  return {
    rt, assignment, admit, session, action,
    advance(ms) { now += ms; },
    now: () => now,
  };
}

test("hard-control contract exposes the complete canonical assignment, lease/fence, and evidence fields", () => {
  const source = readFileSync(new URL("../../../packages/contracts/src/cell-hard-control.ts", import.meta.url), "utf8");
  for (const field of HARD_RUNTIME_REQUIRED_ASSIGNMENT_FIELDS) assert.match(source, new RegExp(field));
  for (const field of ["leaseId","ownerId","issuedAt","expiresAt","heartbeat","fenceToken","idempotencyKey"]) assert.match(source, new RegExp(field));
  for (const field of ["hash","identity","version","timestamp","parent"]) assert.match(source, new RegExp(field));
  assert.deepEqual(HARD_RUNTIME_TASK_STATES, ["QUEUED","ADMITTED","ASSIGNED","RUNNING","RECONCILING","VERIFYING","BLOCKED","FAILED","READY_TO_CLOSE","CLOSED"]);
  assert.deepEqual(HARD_RUNTIME_AGENT_STATES, ["DEFINED","READY","WORKING","DEGRADED","LOST","RECOVERABLE","QUARANTINED","RESTORED"]);
  assert.equal(HARD_CONTROL_RUNTIME_VERSION, "1.0.0");
});

test("admission gate blocks missing task, agent, solver, capability, scope, SHA, opposition plan, risk policy, and acceptance", () => {
  const s = seed();
  assert.throws(() => s.rt.createAssignment({ ...s.assignment, oppositionPlan: "" }), /ADMISSION_BLOCK:OPPOSITION_PLAN_REQUIRED/);
  assert.throws(() => s.rt.createAssignment({ ...s.assignment, acceptance: "" }), /ADMISSION_BLOCK:ACCEPTANCE_REQUIRED/);

  const stale = seed({ taskSha: SHA2 });
  assert.throws(() => stale.admit(), /ADMISSION_BLOCK:STARTING_SHA_INVALID/);

  const invalidTask = seed({ taskValid: false });
  assert.throws(() => invalidTask.admit(), /ADMISSION_BLOCK:TASK_INVALID/);
});

test("admission gate rejects absent role agents and capability/risk/scope policy gaps", () => {
  const missingAgent = seed();
  assert.throws(() => missingAgent.admit({ opponentId: "unknown-opponent" }), /ADMISSION_BLOCK:AGENT_NOT_READY/);

  const missingCapability = seed();
  assert.throws(() => missingCapability.admit({ requiredCapability: "ADMIN" }), /ADMISSION_BLOCK:CAPABILITY_MISMATCH/);

  const missingRiskPolicy = seed();
  assert.throws(() => missingRiskPolicy.admit({ riskClass: "" }), /ADMISSION_BLOCK:RISK_REQUIRED/);

  const missingScope = seed();
  assert.throws(() => missingScope.admit({ scope: { read: [], write: [], branches: [], tools: [], resources: [] } }), /ADMISSION_BLOCK:SCOPE_REQUIRED|ADMISSION_BLOCK:BRANCH_SCOPE_INVALID|ADMISSION_BLOCK:TOOL_RESOURCE_SCOPE_REQUIRED/);
});

test("agent lifecycle state machine is enforced and recoverable", () => {
  const s = seed();
  const rt = s.rt;
  rt.transitionAgent("solver", "WORKING");
  rt.transitionAgent("solver", "DEGRADED");
  rt.transitionAgent("solver", "LOST");
  rt.transitionAgent("solver", "RECOVERABLE");
  rt.transitionAgent("solver", "QUARANTINED");
  rt.transitionAgent("solver", "RESTORED");
  rt.transitionAgent("solver", "READY");
  assert.equal(rt.getAgent("solver").state, "READY");
  assert.throws(() => rt.transitionAgent("solver", "LOST"), /DENY_BEFORE_MUTATION/);
});

test("canonical assignment enforces independent solver/opponent/backups/verifier", () => {
  const s = seed();
  assert.throws(() => s.admit({ opponentId: "solver" }), /ADMISSION_BLOCK:ROLE_INDEPENDENCE_VIOLATION/);
  const admitted = s.admit();
  assert.equal(admitted.solverId, "solver");
  assert.equal(admitted.opponentId, "opponent");
  assert.equal(s.rt.getTask("TASK-1").state, "ADMITTED");
});

test("task state machine rejects illegal closure paths and requires READY_TO_CLOSE", () => {
  const s = seed();
  s.admit();
  assert.throws(() => s.rt.transitionTask("TASK-1", "CLOSED"), /DENY_BEFORE_MUTATION/);
  s.session();
  assert.equal(s.rt.getTask("TASK-1").state, "RUNNING");
  assert.throws(() => s.rt.transitionTask("TASK-1", "CLOSED"), /DENY_BEFORE_MUTATION/);
  const redTeam = s.rt.redTeamGate("TASK-1", { actorId: "opponent", actorRole: "OPPONENT", required: true, findings: 0, remediated: true, retested: true });
  assert.equal(redTeam.pass, true);
  s.rt.reconcile("TASK-1", { solverOutcome: "SUCCESS", opponentOutcome: "PASS" });
  s.rt.prepareVerification("TASK-1");
  s.rt.recordVerification("TASK-1", { verifierId: "verifier", actorRole: "VERIFIER", pass: true, certificationPass: true, reviewId: "REVIEW-1" });
  recordEvidenceThrough(s.rt, "certification");
  const ready = s.rt.markReadyToClose("TASK-1", { opponentResolved: true, redTeamPass: true, verifierPass: true, evidencePass: true });
  assert.equal(ready.state, "READY_TO_CLOSE");
  assert.equal(s.rt.attemptPromotion("TASK-1", { actorId: "solver", actorRole: "SOLVER", redTeamPass: true, opponentResolved: true, verifierPass: true, certificationPass: true, evidencePass: true }).code, "SOLVER_CANNOT_CLOSE");
  assert.equal(s.rt.getTask("TASK-1").state, "READY_TO_CLOSE");
  recordEvidenceThrough(s.rt, "promotion");
  assert.equal(s.rt.attemptPromotion("TASK-1", { actorId: "verifier", actorRole: "VERIFIER", redTeamPass: true, opponentResolved: true, verifierPass: true, certificationPass: true, evidencePass: true }).promoted, true);
  assert.equal(s.rt.getTask("TASK-1").state, "CLOSED");
});

test("hard mutation authorization denies every requested adversarial path before effect", () => {
  const cases = [
    ["wrong agent", { agentId: "intruder" }, "AGENT_ID_MISMATCH"],
    ["wrong task", { taskId: "TASK-2" }, "DENY_BEFORE_MUTATION"],
    ["wrong branch", { branch: "main" }, "BRANCH_DENIED"],
    ["wrong scope", { path: "src/forbidden.ts" }, "SCOPE_DENIED"],
    ["wrong capability", { capability: "ADMIN" }, "CAPABILITY_DENIED"],
    ["wrong SHA", { currentSha: SHA2 }, "SHA_STALE"],
    ["forbidden tool", { toolId: "secret-admin" }, "TOOL_DENIED"],
    ["resource drift", { resource: "network" }, "RESOURCE_DENIED"],
    ["delegation overflow", { delegationDepth: 2 }, "DELEGATION_OVERFLOW"],
    ["budget exceeded", { estimatedCost: 2, estimatedDurationMs: 200 }, "BUDGET_EXCEEDED"],
  ];

  for (const [label, overrides, expected] of cases) {
    const s = seed();
    s.admit();
    const started = s.session();
    const result = s.rt.authorizeMutation(s.action(started, overrides));
    assert.equal(result.allowed, false, label);
    assert.equal(result.code, expected, label);
    assert.equal(s.rt.mutationEffectCount("KEY-1"), 0, label);
  }

  const authority = seed({ solverAuthority: ["READ", "TEST"] });
  authority.admit();
  const started = authority.session();
  const denied = authority.rt.authorizeMutation(authority.action(started));
  assert.equal(denied.code, "AUTHORITY_BYPASS");
  assert.equal(authority.rt.mutationEffectCount("KEY-1"), 0);
});

test("lease, fence, and idempotency enforce single-effect semantics", () => {
  const s = seed();
  s.admit();
  const started = s.session({ ttlMs: 50 });
  const first = s.rt.authorizeMutation(s.action(started));
  assert.equal(first.allowed, true);
  assert.equal(s.rt.mutationEffectCount("KEY-1"), 1);

  const duplicate = s.rt.authorizeMutation(s.action(started, { actionId: "ACTION-2" }));
  assert.equal(duplicate.allowed, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(s.rt.mutationEffectCount("KEY-1"), 1);

  const staleFence = s.rt.authorizeMutation(s.action(started, { idempotencyKey: "KEY-2", fenceToken: started.lease.fenceToken + 1 }));
  assert.equal(staleFence.code, "STALE_FENCE");
  assert.equal(s.rt.mutationEffectCount("KEY-2"), 0);

  s.advance(51);
  const expired = s.rt.authorizeMutation(s.action(started, { idempotencyKey: "KEY-3" }));
  assert.equal(expired.code, "LEASE_EXPIRED");
  assert.equal(s.rt.mutationEffectCount("KEY-3"), 0);
});

test("heartbeat refreshes a live lease and stale heartbeat credentials are denied", () => {
  const s = seed();
  s.admit();
  const started = s.session({ ttlMs: 20 });
  s.advance(10);
  const refreshed = s.rt.heartbeatLease(started.sessionId, {
    ownerId: "solver",
    leaseId: started.lease.leaseId,
    fenceToken: started.lease.fenceToken,
    ttlMs: 50,
  });
  assert.ok(refreshed.lease.expiresAt > started.lease.expiresAt);
  assert.throws(() => s.rt.heartbeatLease(started.sessionId, {
    ownerId: "intruder",
    leaseId: started.lease.leaseId,
    fenceToken: started.lease.fenceToken,
  }), /STALE_FENCE/);
});

test("solver success plus opponent counterexample is reconciled, never auto-closed", () => {
  const s = seed({ riskClass: "HIGH" });
  s.admit();
  s.session();
  const result = s.rt.reconcile("TASK-1", { solverOutcome: "SUCCESS", opponentOutcome: "COUNTEREXAMPLE" });
  assert.equal(result.decision, "ESCALATE");
  assert.equal(s.rt.getTask("TASK-1").state, "RECONCILING");
  const arbitration = arbitrateHardControlConflict({ riskClass: "HIGH", solverOutcome: "SUCCESS", opponentOutcome: "COUNTEREXAMPLE" });
  assert.deepEqual(arbitration, { decision: "ESCALATE", closeAllowed: false });
});

test("red-team and verifier gates require the assigned independent actors", () => {
  const s = seed({ riskClass: "HIGH" });
  s.admit();
  s.session();
  assert.throws(() => s.rt.redTeamGate("TASK-1", {
    required: true, findings: 0, remediated: true, retested: true,
  }), /AUTHORITY_BYPASS/);
  s.rt.reconcile("TASK-1", { solverOutcome: "SUCCESS", opponentOutcome: "PASS" });
  s.rt.redTeamGate("TASK-1", {
    actorId: "opponent", actorRole: "OPPONENT", required: true, findings: 0, remediated: true, retested: true,
  });
  s.rt.prepareVerification("TASK-1");
  assert.throws(() => s.rt.recordVerification("TASK-1", {
    verifierId: "solver", actorRole: "VERIFIER", pass: true, certificationPass: true, reviewId: "REVIEW-X",
  }), /AUTHORITY_BYPASS/);
});

test("red-team handoff is a hard gate until findings are remediated and re-tested", () => {
  const s = seed({ riskClass: "HIGH" });
  s.admit();
  s.session();
  s.rt.reconcile("TASK-1", { solverOutcome: "SUCCESS", opponentOutcome: "PASS" });
  const blocked = s.rt.redTeamGate("TASK-1", { actorId: "opponent", actorRole: "OPPONENT", required: false, findings: 1, remediated: false, retested: false });
  assert.equal(blocked.gate, "BLOCK");
  s.rt.prepareVerification("TASK-1");
  assert.equal(s.rt.markReadyToClose("TASK-1", { opponentResolved: true, redTeamPass: false, verifierPass: true, evidencePass: true }).code, "CLOSURE_BLOCKED");
  const passed = s.rt.redTeamGate("TASK-1", { actorId: "opponent", actorRole: "OPPONENT", required: true, findings: 0, remediated: true, retested: true });
  assert.equal(passed.gate, "PASS");
});

test("evidence chain requires hash, identity, version, timestamp, parent and complete lineage", () => {
  const s = seed();
  let parent = null;
  for (const kind of ["sourceSha","build","session","action","candidate","test","opponent","redTeam","verifier","certification","promotion"]) {
    const node = buildHardControlEvidenceNode({
      id: "E-" + kind,
      kind,
      identity: "CELL",
      version: HARD_CONTROL_RUNTIME_VERSION,
      timestamp: 1000 + s.rt.evidence.size,
      parent,
    });
    s.rt.recordEvidenceNode(node);
    parent = node.id;
  }
  assert.deepEqual(s.rt.verifyEvidenceChain(), { pass: true, code: "VERIFIED", count: 11 });

  const tampered = { ...buildHardControlEvidenceNode({ id: "TAMPER", kind: "sourceSha", identity: "CELL", version: "1.0.0", timestamp: 1000, parent: null }), hash: HASH };
  assert.throws(() => s.rt.recordEvidenceNode(tampered), /UNVERIFIABLE/);

  const stored = s.rt.evidence.get("E-sourceSha");
  s.rt.evidence.set("E-sourceSha", { ...stored, identity: "POISONED" });
  assert.equal(s.rt.verifyEvidenceChain().reason, "NODE_HASH_MISMATCH");

  const missing = seed();
  missing.rt.recordEvidenceNode(buildHardControlEvidenceNode({
    id: "E-sourceSha", kind: "sourceSha", identity: "CELL", version: "1.0.0", timestamp: 1000, parent: null,
  }));
  assert.equal(missing.rt.verifyEvidenceChain().code, "UNVERIFIABLE");
  assert.equal(missing.rt.classifyEvidenceSha(SHA2), "STALE");
});

test("opponent loss and solver loss do not destroy the task; backup roles recover execution", () => {
  const opponent = seed();
  opponent.admit();
  opponent.session();
  opponent.rt.transitionAgent("opponent", "WORKING");
  opponent.rt.crashAgent("opponent");
  assert.equal(opponent.rt.getAgent("opponent").state, "LOST");
  assert.equal(opponent.rt.getTask("TASK-1").state, "BLOCKED");
  const reassignedOpponent = opponent.rt.reassign("ASSIGN-1");
  assert.equal(reassignedOpponent.opponentId, "backup-opponent");
  assert.equal(opponent.rt.getTask("TASK-1").state, "RUNNING");

  const solver = seed();
  solver.admit();
  solver.session();
  solver.rt.crashAgent("solver");
  assert.equal(solver.rt.getAgent("solver").state, "LOST");
  assert.equal(solver.rt.getTask("TASK-1").state, "BLOCKED");
  const reassignedSolver = solver.rt.reassign("ASSIGN-1");
  assert.equal(reassignedSolver.solverId, "backup-solver");
  assert.equal(solver.rt.getTask("TASK-1").state, "RUNNING");
  assert.equal(solver.rt.recoverAgent("solver").state, "RESTORED");
  assert.equal(solver.rt.getTask("TASK-1").taskId, "TASK-1");
});

test("master, scheduler, reconciliation and promotion restart preserve task, assignment, lease journal and evidence lineage", () => {
  const s = seed();
  s.admit();
  const started = s.session();
  s.rt.authorizeMutation(s.action(started));
  s.rt.recordEvidenceNode(buildHardControlEvidenceNode({
    id: "E-source", kind: "sourceSha", identity: "CELL", version: "1.0.0", timestamp: 1000, parent: null,
  }));

  let restarted = s.rt.restart("master");
  restarted = restarted.restart("scheduler");
  restarted = restarted.restart("reconciliation");
  restarted = restarted.restart("promotion");
  assert.equal(restarted.getTask("TASK-1").taskId, "TASK-1");
  assert.equal(restarted.getAssignment("ASSIGN-1").assignmentId, "ASSIGN-1");
  assert.equal(restarted.mutationEffectCount("KEY-1"), 1);
  assert.ok(restarted.evidence.has("E-source"));
});

test("restart preserves live reconciliation and READY_TO_CLOSE state before promotion", () => {
  const s = seed({ riskClass: "HIGH" });
  s.admit();
  s.session();
  s.rt.reconcile("TASK-1", { solverOutcome: "SUCCESS", opponentOutcome: "COUNTEREXAMPLE" });
  const duringReconciliation = s.rt.restart("master");
  assert.equal(duringReconciliation.getTask("TASK-1").state, "RECONCILING");
  assert.equal(duringReconciliation.getTask("TASK-1").taskId, "TASK-1");

  duringReconciliation.redTeamGate("TASK-1", {
    actorId: "opponent", actorRole: "OPPONENT", required: true, findings: 0, remediated: true, retested: true,
  });
  duringReconciliation.prepareVerification("TASK-1");
  duringReconciliation.recordVerification("TASK-1", {
    verifierId: "verifier", actorRole: "VERIFIER", pass: true, certificationPass: true, reviewId: "REVIEW-1",
  });
  recordEvidenceThrough(duringReconciliation, "certification");
  const ready = duringReconciliation.markReadyToClose("TASK-1", {
    opponentResolved: true, redTeamPass: true, verifierPass: true, evidencePass: true,
  });
  assert.equal(ready.state, "READY_TO_CLOSE");

  const duringPromotion = duringReconciliation.restart("promotion");
  assert.equal(duringPromotion.getTask("TASK-1").state, "READY_TO_CLOSE");
  recordEvidenceThrough(duringPromotion, "promotion");
  assert.equal(duringPromotion.attemptPromotion("TASK-1", {
    actorId: "verifier", actorRole: "VERIFIER",
  }).code, "PROMOTED");
  assert.equal(duringPromotion.getTask("TASK-1").state, "CLOSED");
});

test("duplicate scheduler wake is idempotent for the same session identity", () => {
  const s = seed();
  s.admit();
  const first = s.session({ sessionId: "WAKE-1", ttlMs: 1000 });
  const duplicate = s.rt.startSession("ASSIGN-1", { sessionId: "WAKE-1", ttlMs: 1000 });
  assert.equal(duplicate.lease.leaseId, first.lease.leaseId);
  assert.equal(duplicate.sessionId, first.sessionId);
  assert.equal(s.rt.sessions.size, 1);
});

test("partial write recovery aborts an incomplete effect and leaves idempotency safe", () => {
  const s = seed();
  s.admit();
  s.session();
  assert.deepEqual(s.rt.simulatePartialWrite("PARTIAL-1", "TASK-1"), { status: "PENDING", effectApplied: false });
  const restarted = s.rt.restart("master");
  assert.equal(restarted.recoverPartialWrites(), 1);
  assert.equal(restarted.mutationEffectCount("PARTIAL-1"), 0);
  assert.deepEqual(restarted.simulatePartialWrite("PARTIAL-1", "TASK-1"), { status: "DUPLICATE", effectApplied: false });
});

test("network partition denies mutation without effect, then normal operation resumes", () => {
  const s = seed();
  s.admit();
  const started = s.session();
  s.rt.setPartitioned(true);
  const denied = s.rt.authorizeMutation(s.action(started));
  assert.equal(denied.code, "NETWORK_PARTITION");
  assert.equal(s.rt.mutationEffectCount("KEY-1"), 0);
  s.rt.setPartitioned(false);
  assert.equal(s.rt.authorizeMutation(s.action(started)).allowed, true);
});

test("all ten drift categories are detected and remain non-authoritative", () => {
  const s = seed();
  s.admit();
  const findings = s.rt.detectScopeDrift({
    assignmentId: "ASSIGN-1",
    path: "forbidden/outside.ts",
    branch: "main",
    objectiveId: "OBJ-DRIFT",
    toolId: "forbidden-tool",
    resource: "network",
    now: 5000,
    currentSha: SHA2,
    agentId: "intruder",
    strategyId: "STRATEGY-DRIFT",
    delegationDepth: 99,
    memorySourceSha: SHA2,
  });
  assert.deepEqual(new Set(findings.map((f) => f.type)), new Set(HARD_DRIFT_CODES));
  assert.ok(s.rt.metricsSnapshot().scope_violations >= 10);
});

test("memory poisoning and conflicts fail closed through D10 truth-memory control", () => {
  assert.equal(authorizeMemoryUse({ sourceSha: SHA, currentSha: SHA, provenance: ["E-1"], confidence: 1, trusted: true, conflict: false }).allowed, true);
  assert.equal(authorizeMemoryUse({ sourceSha: SHA2, currentSha: SHA, provenance: ["E-1"], confidence: 1, trusted: true, conflict: false }).code, "D10_TRUTH_MEMORY");
  assert.equal(authorizeMemoryUse({ sourceSha: SHA, currentSha: SHA, provenance: [], confidence: 1, trusted: true, conflict: false }).code, "D10_TRUTH_MEMORY");
  assert.equal(authorizeMemoryUse({ sourceSha: SHA, currentSha: SHA, provenance: ["E-1"], confidence: 1, trusted: true, conflict: true }).code, "D10_TRUTH_MEMORY");
});

test("self-evolution can propose only through a canonical task/review/verification adoption gate", () => {
  const s = seed();
  s.admit();
  const proposal = s.rt.proposeSelfEvolution({
    taskId: "TASK-1",
    proposalId: "EVOLVE-1",
    weakness: "evidence freshness gap",
    hypothesis: "bind promotion to fresh source SHA",
    experiment: "run stale-SHA and restart drills",
    opponentId: "opponent",
    redTeamPlan: "attempt promotion bypass",
    verificationPlan: "exact-SHA regression",
    reviewId: "REVIEW-1",
    verificationId: "VERIFY-1",
  });
  assert.equal(proposal.state, "PROPOSED");
  assert.throws(() => s.rt.adoptSelfEvolution("EVOLVE-1", {
    canonicalTaskId: "TASK-1",
    reviewId: "REVIEW-1",
    verificationId: "VERIFY-1",
    independentReview: false,
    verified: false,
    redTeamPass: false,
    evidencePass: false,
  }), /EVOLUTION_GOVERNANCE_BLOCK/);

  s.session();
  s.rt.reconcile("TASK-1", { solverOutcome: "SUCCESS", opponentOutcome: "PASS" });
  s.rt.redTeamGate("TASK-1", { actorId: "opponent", actorRole: "OPPONENT", required: true, findings: 0, remediated: true, retested: true });
  s.rt.prepareVerification("TASK-1");
  s.rt.recordVerification("TASK-1", { verifierId: "verifier", actorRole: "VERIFIER", pass: true, certificationPass: true, reviewId: "REVIEW-1" });
  recordEvidenceThrough(s.rt, "certification");
  s.rt.markReadyToClose("TASK-1", { opponentResolved: true, redTeamPass: true, verifierPass: true, evidencePass: true });
  const adopted = s.rt.adoptSelfEvolution("EVOLVE-1", {
    canonicalTaskId: "TASK-1",
    reviewId: "REVIEW-1",
    verificationId: "VERIFY-1",
    independentReview: true,
    verified: true,
    redTeamPass: true,
    evidencePass: true,
  });
  assert.equal(adopted.state, "ADOPTED");
});

test("observability exposes every required hard-control metric", () => {
  const s = seed();
  s.admit();
  const metrics = s.rt.metricsSnapshot();
  for (const key of [
    "task_progression","assignment_success","reassignment_rate","opponent_yield","red_team_yield",
    "recovery_success","evidence_staleness","false_green_rate","scope_violations","thrashing","routing_regret",
  ]) assert.ok(Object.prototype.hasOwnProperty.call(metrics, key), key);
});

test("matrix declares the full behavioral CELL harness, including crash/restart/fence/promotion scenarios", () => {
  const matrix = hardControlTestMatrix();
  for (const requiredCase of [
    "task admission","solver/opponent pairing","scope denial","stale SHA","opponent loss","solver loss",
    "red-team handoff","conflict arbitration","memory poisoning","memory conflict","master restart","scheduler restart",
    "promotion protection","wrong agent","wrong task","wrong branch","wrong capability","wrong SHA","expired lease",
    "stale fence token","forbidden tool","budget exceeded","delegation overflow","authority bypass","duplicate wake",
    "partial write","network partition","restart during reconciliation","restart during promotion",
  ]) assert.ok(matrix.includes(requiredCase), requiredCase);
});
