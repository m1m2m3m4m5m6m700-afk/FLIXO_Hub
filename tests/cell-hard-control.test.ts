import test from "node:test";
import assert from "node:assert/strict";
import { admitCellAction, validateCellEnvelope } from "../src/lib/cell/hard-control.ts";
import { CELL_POLICY_VERSION, type CellExecutionEnvelope } from "../src/lib/cell/types.ts";

const SHA = "a".repeat(40);

function envelope(overrides: Partial<CellExecutionEnvelope> = {}): CellExecutionEnvelope {
  return Object.freeze({
    executionId: "exec-001",
    taskId: "task-001",
    agentId: "agent-001",
    repository: "FLIXO_Hub",
    baseSha: SHA,
    currentSha: SHA,
    branch: "execution",
    objectiveDigest: "objective-digest",
    acceptanceDigest: "acceptance-digest",
    policyVersion: CELL_POLICY_VERSION,
    authority: "IMPLEMENTER",
    capabilities: Object.freeze(["image-converter"]),
    scopes: Object.freeze(["capability:image-converter"]),
    forbiddenActions: Object.freeze([
      "CELL_POLICY_MUTATION",
      "AUTHORITY_ESCALATION",
      "SCOPE_EXPANSION",
      "UNVERIFIED_PROMOTION",
    ]),
    budget: Object.freeze({
      maxAttempts: 3,
      maxDelegationDepth: 2,
      maxChildren: 4,
      timeoutMs: 30_000,
    }),
    evidence: Object.freeze({
      requireExecutionId: true,
      requireExactSha: true,
      requireVerifier: true,
      requireEvidenceDigest: false,
    }),
    ...overrides,
  });
}

function request(overrides: Partial<Parameters<typeof admitCellAction>[1]> = {}) {
  return {
    action: "CANONICAL_TOOL_EXECUTION",
    capability: "image-converter",
    scope: "capability:image-converter",
    repository: "FLIXO_Hub",
    currentSha: SHA,
    objectiveDigest: "objective-digest",
    acceptanceDigest: "acceptance-digest",
    evidenceRequested: false,
    ...overrides,
  };
}

test("CELL accepts an unchanged admitted action", () => {
  const decision = admitCellAction(envelope(), request());
  assert.equal(decision.allowed, true);
});

test("CELL fails closed on capability escalation", () => {
  const decision = admitCellAction(envelope(), request({ capability: "video-compressor" }));
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.code, "CAPABILITY_NOT_GRANTED");
});

test("CELL fails closed on scope escape", () => {
  const decision = admitCellAction(envelope(), request({ scope: "repository:main" }));
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.code, "SCOPE_NOT_GRANTED");
});

test("CELL rejects objective and acceptance drift", () => {
  const objective = admitCellAction(envelope(), request({ objectiveDigest: "changed" }));
  assert.equal(objective.allowed, false);
  if (!objective.allowed) assert.equal(objective.code, "OBJECTIVE_DRIFT");

  const acceptance = admitCellAction(envelope(), request({ acceptanceDigest: "changed" }));
  assert.equal(acceptance.allowed, false);
  if (!acceptance.allowed) assert.equal(acceptance.code, "ACCEPTANCE_DRIFT");
});

test("CELL rejects SHA drift", () => {
  const decision = admitCellAction(envelope(), request({ currentSha: "b".repeat(40) }));
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.code, "SHA_DRIFT");
});

test("CELL rejects delegation privilege escalation", () => {
  const decision = admitCellAction(envelope(), request({ childAuthority: "CERTIFIER" }));
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.code, "AUTHORITY_ESCALATION");
});

test("CELL rejects forbidden actions and self-modification", () => {
  const forbidden = admitCellAction(envelope(), request({ action: "UNVERIFIED_PROMOTION" }));
  assert.equal(forbidden.allowed, false);
  if (!forbidden.allowed) assert.equal(forbidden.code, "FORBIDDEN_ACTION");

  const mutation = admitCellAction(envelope(), request({ action: "CELL_POLICY_MUTATION" }));
  assert.equal(mutation.allowed, false);
  if (!mutation.allowed) assert.equal(mutation.code, "FORBIDDEN_ACTION");
});

test("CELL enforces bounded retry and delegation budgets", () => {
  const badAttempts = validateCellEnvelope(envelope({
    budget: Object.freeze({ maxAttempts: 4, maxDelegationDepth: 2, maxChildren: 4, timeoutMs: 30_000 }),
  }));
  assert.equal(badAttempts.allowed, false);

  const badDepth = admitCellAction(envelope(), request({ delegationDepth: 3 }));
  assert.equal(badDepth.allowed, false);
  if (!badDepth.allowed) assert.equal(badDepth.code, "DELEGATION_DEPTH_EXCEEDED");
});

test("CELL allows exact-SHA evidence only for a pinned state", () => {
  const decision = validateCellEnvelope(envelope({ baseSha: SHA, currentSha: "b".repeat(40) }));
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.code, "SHA_DRIFT");
});
