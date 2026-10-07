import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeExecutionAction,
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
} from "../../packages/contracts/src/cell-hard-control.ts";
import { CellRuntime } from "../../packages/contracts/src/cell-runtime.ts";

const envelope: ExecutionEnvelope = Object.freeze({
  taskId: "TASK-1",
  agentId: "AGENT-1",
  sessionId: "SESSION-1",
  missionId: "MISSION-1",
  startSha: "sha-start",
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
  currentSha: "sha-live",
  operation: "WRITE",
  path: "src/lib/video/fixture.ts",
  capability: "edit-source",
  toolId: "editor",
  estimatedCost: 1,
  expectedDurationMs: 100,
  delegationDepth: 0,
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
      startSha: "sha-start",
      currentSha: "sha-live",
      capability: "edit-source",
      objectiveId: "OBJ-VIDEO",
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

test("live SHA mismatch blocks mutation even when the envelope is otherwise valid", () => {
  const rt = new CellRuntime(() => 1000);
  const denied = rt.authorizeAction(envelope, action({ currentSha: "sha-old" }), "sha-live");
  assert.equal(denied.allowed, false);
  assert.equal(denied.drift?.type, "D6_EVIDENCE_DRIFT");
  assert.equal(rt.listActionRecords().length, 1);
  assert.equal(rt.getTaskBudget("TASK-1").spentCost, 0);
});

test("accepted actions consume budget and later actions are denied", () => {
  const rt = new CellRuntime(() => 1000);
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
