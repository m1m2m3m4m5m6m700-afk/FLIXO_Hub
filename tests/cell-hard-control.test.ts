import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeExecutionAction,
  type ExecutionAction,
  type ExecutionEnvelope,
} from "../packages/contracts/src/cell-hard-control.ts";

const START_SHA = "a".repeat(40);
const LIVE_SHA = "b".repeat(40);

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

test("canonical CELL hard control admits only in-scope work on the execution branch", () => {
  assert.equal(authorizeExecutionAction(envelope, action(), { spentCost: 0, spentDurationMs: 0 }).allowed, true);
  const outOfScope = authorizeExecutionAction(
    envelope,
    action({ path: "src/lib/security/auth.ts" }),
    { spentCost: 0, spentDurationMs: 0 },
  );
  assert.equal(outOfScope.allowed, false);
  assert.equal(outOfScope.drift?.type, "D1_SCOPE_DRIFT");

  const wrongBranch = authorizeExecutionAction(
    envelope,
    action({ branch: "main" }),
    { spentCost: 0, spentDurationMs: 0 },
  );
  assert.equal(wrongBranch.allowed, false);
});

test("canonical CELL hard control rejects capability escalation and SHA drift", () => {
  const unauthorized = authorizeExecutionAction(
    envelope,
    action({ capability: "governance-admin" }),
    { spentCost: 0, spentDurationMs: 0 },
  );
  assert.equal(unauthorized.allowed, false);
  assert.equal(unauthorized.drift?.type, "D3_TOOL_DRIFT");

  const stale = authorizeExecutionAction(
    envelope,
    action({ currentSha: "invalid-sha" }),
    { spentCost: 0, spentDurationMs: 0 },
  );
  assert.equal(stale.allowed, false);
  assert.equal(stale.drift?.type, "D6_EVIDENCE_DRIFT");
});
