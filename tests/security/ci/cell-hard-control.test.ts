import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeExecutionAction,
  createExecutionEnvelope,
  calculateProgressScore,
  classifyMemoryDrift,
  classifyObjectiveDrift,
  classifyStrategyDrift,
  classifyTemporalDrift,
  matchesScope,
  outOfScopeProposal,
  verifyExecutionIdentity,
  type ExecutionAction,
  type ExecutionEnvelope,
} from "../../../packages/contracts/src/cell-hard-control.ts";
import { CellRuntime } from "../../../packages/contracts/src/cell-runtime.ts";
import { decideRetry } from "../../../packages/contracts/src/cell-control-plane.ts";
import { authorizeDelegation } from "../../../packages/contracts/src/cell-assignment.ts";
// Load the behavioral CELL harness into the same hard-control test gate.
import "./cell-hard-control-e2e.test.mjs";

const START_SHA = "a".repeat(40);
const LIVE_SHA = "b".repeat(40);
const OLD_SHA = "c".repeat(40);

const envelope: ExecutionEnvelope = Object.freeze({
  taskId: "TASK-1",
  agentId: "AGENT-1",
  sessionId: "SESSION-1",
  missionId: "MISSION-1",
  startSha: START_SHA,
  allowedCapabilities: Object.freeze(["edit-source", "test"]),
  readScope: Object.freeze(["src/lib/video/**", "tests/**"]),
  writeScope: Object.freeze(["src/lib/video/**", "tests/**"]),
  allowedBranch: "execution",
  forbiddenActions: Object.freeze(["tool:git-admin", "DEPLOY"]),
  expectedOutput: "VIDEO-FIXTURE",
  acceptanceConditions: Object.freeze(["fixture passes"]),
  evidenceRequirements: Object.freeze(["exact SHA"]),
  timeBudgetMs: 1000,
  costBudget: 10,
  maxDelegationDepth: 2,
  normalizedObjectiveId: "OBJ-VIDEO",
  acceptanceDigest: "accept-1",
});

const action = (overrides: Partial<ExecutionAction> = {}): ExecutionAction => ({
  actionId: "ACTION-1",
  taskId: "TASK-1",
  agentId: "AGENT-1",
  sessionId: "SESSION-1",
  missionId: "MISSION-1",
  branch: "execution",
  startSha: START_SHA,
  currentSha: LIVE_SHA,
  operation: "WRITE",
  path: "src/lib/video/fixture.ts",
  capability: "edit-source",
  toolId: "editor",
  estimatedCost: 1,
  expectedDurationMs: 100,
  delegationDepth: 0,
  objectiveId: "OBJ-VIDEO",
  acceptanceDigest: "accept-1",
  ...overrides,
});

test("scope firewall allows in-scope writes and denies out-of-scope writes", () => {
  assert.equal(matchesScope("src/lib/video/fixture.ts", envelope.writeScope), true);
  assert.equal(matchesScope("src/lib/security/auth.ts", envelope.writeScope), false);
  assert.equal(authorizeExecutionAction(envelope, action(), { spentCost: 0, spentDurationMs: 0 }).allowed, true);
  const denied = authorizeExecutionAction(
    envelope,
    action({ path: "src/lib/security/auth.ts" }),
    { spentCost: 0, spentDurationMs: 0 },
  );
  assert.equal(denied.allowed, false);
  assert.equal(denied.drift?.type, "D1_SCOPE_DRIFT");
});

test("read scope and current SHA are mandatory before authorization", () => {
  const read = action({ operation: "READ", path: "tests/security/ci/example.test.ts" });
  assert.equal(authorizeExecutionAction(envelope, read, { spentCost: 0, spentDurationMs: 0 }).allowed, true);

  const outOfScope = authorizeExecutionAction(
    envelope,
    action({ operation: "READ", path: "src/lib/security/auth.ts" }),
    { spentCost: 0, spentDurationMs: 0 },
  );
  assert.equal(outOfScope.allowed, false);
  assert.equal(outOfScope.drift?.type, "D1_SCOPE_DRIFT");

  const missingSha = authorizeExecutionAction(
    envelope,
    action({ operation: "READ", path: "tests/security/ci/example.test.ts", currentSha: "" }),
    { spentCost: 0, spentDurationMs: 0 },
  );
  assert.equal(missingSha.allowed, false);
  assert.equal(missingSha.drift?.type, "D6_EVIDENCE_DRIFT");
});

test("branch and capability firewalls reject authority expansion", () => {
  assert.equal(
    authorizeExecutionAction(envelope, action({ branch: "main" }), { spentCost: 0, spentDurationMs: 0 }).drift?.type,
    "D1_SCOPE_DRIFT",
  );
  assert.equal(
    authorizeExecutionAction(envelope, action({ capability: "governance-admin" }), { spentCost: 0, spentDurationMs: 0 }).drift?.type,
    "D3_TOOL_DRIFT",
  );
});

test("identity and objective anchors fail closed", () => {
  assert.equal(
    verifyExecutionIdentity(envelope, {
      taskId: "TASK-2",
      agentId: "AGENT-1",
      sessionId: "SESSION-1",
      missionId: "MISSION-1",
      branch: "execution",
      startSha: START_SHA,
      currentSha: LIVE_SHA,
      capability: "edit-source",
      objectiveId: "OBJ-VIDEO",
      acceptanceDigest: "accept-1",
      expectedOutput: "VIDEO-FIXTURE",
    }),
    "TASK_ID_MISMATCH",
  );
  assert.equal(classifyObjectiveDrift(envelope, "OBJ-OTHER")?.type, "D2_OBJECTIVE_DRIFT");
});

test("resource, temporal and delegation limits deny before execution", () => {
  assert.equal(
    authorizeExecutionAction(
      envelope,
      action({ estimatedCost: 20 }),
      { spentCost: 0, spentDurationMs: 0 },
    ).drift?.type,
    "D4_RESOURCE_DRIFT",
  );
  assert.equal(classifyTemporalDrift(1100, 1000)?.type, "D5_TEMPORAL_DRIFT");
  assert.equal(
    authorizeExecutionAction(
      envelope,
      action({ delegationDepth: 3, operation: "DELEGATE", path: null }),
      { spentCost: 0, spentDurationMs: 0 },
    ).drift?.type,
    "D9_DELEGATION_DRIFT",
  );
});

test("reference runtime rejects every execution action outside RUNNING state", () => {
  const rt = new CellRuntime(() => 1000);
  rt.registerTask("TASK-1");
  const denied = rt.authorizeAction(envelope, action(), "sha-live");
  assert.equal(denied.allowed, false);
  assert.equal(denied.drift?.type, "D7_AUTHORITY_DRIFT");
  assert.equal(rt.listActionRecords().length, 1);
  assert.equal(rt.getTaskBudget("TASK-1").spentCost, 0);
});

test("live SHA mismatch blocks mutation even when the envelope is otherwise valid", () => {
  const rt = new CellRuntime(() => 1000);
  rt.registerTask("TASK-1");
  const denied = rt.authorizeAction(envelope, action({ currentSha: OLD_SHA }), "sha-live");
  assert.equal(denied.allowed, false);
  assert.equal(denied.drift?.type, "D6_EVIDENCE_DRIFT");
  assert.equal(rt.listActionRecords().length, 1);
  assert.equal(rt.getTaskBudget("TASK-1").spentCost, 0);
});

test("accepted actions consume budget and later actions are denied", () => {
  const rt = new CellRuntime(() => 1000);
  rt.registerTask("TASK-1");
  rt.transitionTask("TASK-1", "READY");
  rt.assignTask("TASK-1", {
    assignmentId: "ACTION-ASSIGN",
    primaryAgentId: "AGENT-1",
    backupAgentId: "AGENT-2",
    verifierAgentId: null,
    escalationTargetAgentId: null,
    startingSha: START_SHA,
    currentSha: LIVE_SHA,
  }, "sha-live");
  rt.transitionTask("TASK-1", "CLAIMED");
  rt.transitionTask("TASK-1", "RUNNING");
  const first = rt.authorizeAction(envelope, action(), "sha-live");
  assert.equal(first.allowed, true);
  assert.equal(rt.getTaskBudget("TASK-1").spentCost, 1);
  const second = rt.authorizeAction(
    envelope,
    action({ actionId: "ACTION-2", estimatedCost: 9, expectedDurationMs: 900 }),
    "sha-live",
  );
  assert.equal(second.allowed, true);
  const third = rt.authorizeAction(
    envelope,
    action({ actionId: "ACTION-3", estimatedCost: 1, expectedDurationMs: 1 }),
    "sha-live",
  );
  assert.equal(third.allowed, false);
  assert.equal(third.drift?.type, "D4_RESOURCE_DRIFT");
});

test("strategy drift is a replan signal while memory drift invalidates knowledge", () => {
  assert.equal(calculateProgressScore({
    verifiedObjectiveDelta: 0.8,
    acceptanceCoverage: 0.8,
    relevantArtifactScore: 0.8,
    verifiedDelta: 0.8,
    informationGain: 0.8,
    budgetConsumed: 1,
  }), 0.8);
  assert.equal(classifyStrategyDrift(0.2, 0.5)?.response, "REPLAN");
  assert.equal(classifyMemoryDrift("sha-old", "sha-live", "PROMOTED")?.response, "INVALIDATE");
  assert.equal(classifyMemoryDrift("sha-live", "sha-live", "PROMOTED"), null);
});

test("out-of-scope discovery becomes a new-task proposal instead of self-expansion", () => {
  assert.deepEqual(
    outOfScopeProposal("TASK-1", "AGENT-1", "src/lib/security/auth.ts"),
    {
      taskId: "TASK-1",
      agentId: "AGENT-1",
      path: "src/lib/security/auth.ts",
      action: "NEW_TASK_PROPOSAL",
    },
  );
});

test("acceptance digest drift is blocked", () => {
  const result = authorizeExecutionAction(
    envelope,
    action({ acceptanceDigest: "changed-after-claim" }),
    { spentCost: 0, spentDurationMs: 0 },
  );
  assert.equal(result.allowed, false);
  assert.equal(result.drift?.type, "D2_OBJECTIVE_DRIFT");
});

test("execution envelope is immutable and cannot be expanded by the agent", () => {
  const created = createExecutionEnvelope(envelope);
  assert.throws(() => {
    (created as { allowedCapabilities: string[] }).allowedCapabilities.push("governance-admin");
  }, TypeError);
  assert.equal(created.allowedCapabilities.includes("governance-admin"), false);
});


test("CELL authority attenuation blocks delegated privilege escalation", () => {
  const childEscalation = authorizeExecutionAction(
    { ...envelope, authority: "IMPLEMENTER" },
    action({ operation: "DELEGATE", delegatedAuthority: "CERTIFIER" }),
    { spentCost: 0, spentDurationMs: 0 },
  );
  assert.equal(childEscalation.allowed, false);
  assert.equal(childEscalation.drift?.type, "D9_DELEGATION_DRIFT");

  const attenuated = authorizeExecutionAction(
    { ...envelope, authority: "IMPLEMENTER" },
    action({ operation: "DELEGATE", delegatedAuthority: "ANALYST" }),
    { spentCost: 0, spentDurationMs: 0 },
  );
  assert.equal(attenuated.allowed, true);
});

test("CELL self-protection denies mutation of control-plane sources without ROOT", () => {
  const denied = authorizeExecutionAction(
    { ...envelope, authority: "IMPLEMENTER" },
    action({ operation: "WRITE", path: "packages/contracts/src/cell-hard-control.ts" }),
    { spentCost: 0, spentDurationMs: 0 },
  );
  assert.equal(denied.allowed, false);
  assert.equal(denied.drift?.type, "D7_AUTHORITY_DRIFT");

  const root = authorizeExecutionAction(
    {
      ...envelope,
      authority: "ROOT",
      writeScope: Object.freeze(["src/lib/video/**", "tests/**", "packages/contracts/src/cell-hard-control.ts"]),
    },
    action({ operation: "WRITE", path: "packages/contracts/src/cell-hard-control.ts" }),
    { spentCost: 0, spentDurationMs: 0 },
  );
  assert.equal(root.allowed, true);
});



test("CELL canonical retry gate forbids replanning and policy failures", () => {
  const allowed = decideRetry({
    attempts: 1,
    maxAttempts: 3,
    retryable: true,
    failureFingerprint: "timeout-1",
    previousFailureFingerprint: "timeout-0",
    sameCapability: true,
    sameParameters: true,
    replanned: false,
  });
  assert.equal(allowed.allowed, true);

  const scope = decideRetry({
    attempts: 1,
    maxAttempts: 3,
    retryable: true,
    failureFingerprint: "scope-1",
    previousFailureFingerprint: "scope-0",
    sameCapability: true,
    sameParameters: true,
    replanned: false,
  });
  assert.equal(scope.allowed, true);

  const replan = decideRetry({
    attempts: 1,
    maxAttempts: 3,
    retryable: true,
    failureFingerprint: "timeout-2",
    previousFailureFingerprint: "timeout-1",
    sameCapability: true,
    sameParameters: true,
    replanned: true,
  });
  assert.equal(replan.allowed, false);
  assert.equal(replan.reason, "RETRY_REPLAN_FORBIDDEN");

  const budget = decideRetry({
    attempts: 3,
    maxAttempts: 99,
    retryable: true,
    failureFingerprint: "timeout-3",
    previousFailureFingerprint: "timeout-2",
    sameCapability: true,
    sameParameters: true,
    replanned: false,
  });
  assert.equal(budget.allowed, false);
  assert.equal(budget.reason, "RETRY_BUDGET_EXHAUSTED");
});


test("CELL delegation rules reject authority escalation at the handoff boundary", () => {
  const rule = {
    sourceAgentId: "AGENT-1",
    targetAgentId: "AGENT-2",
    taskTypes: ["implementation"],
    riskClasses: ["medium"],
    maxDepth: 2,
    maxActiveSubtasks: 2,
    maxCost: 10,
    maxDurationMs: 1000,
    sourceAuthority: "IMPLEMENTER" as const,
    targetAuthority: "CERTIFIER" as const,
  };
  const request = {
    taskId: "TASK-1",
    sourceAgentId: "AGENT-1",
    targetAgentId: "AGENT-2",
    taskType: "implementation",
    riskClass: "medium",
    depth: 1,
    activeSubtasks: 1,
    estimatedCost: 1,
    estimatedDurationMs: 100,
  };
  assert.equal(authorizeDelegation([rule], request), false);
  assert.equal(
    authorizeDelegation(
      [{ ...rule, targetAuthority: "ANALYST" as const }],
      request,
    ),
    true,
  );
});
