import assert from "node:assert/strict";
import test from "node:test";
import {
  assertLeaseOwner,
  assertTransition,
  canPromote,
  classifyEvidence,
  decideRetry,
  guardianDecision,
  isMemoryActionable,
  scoreFrontier,
} from "../../packages/contracts/src/cell-control-plane.ts";

test("task state machine rejects illegal promotion bypass", () => {
  assert.throws(() => assertTransition("TASK", "RUNNING", "PROMOTED"), /INVALID_TASK_TRANSITION/);
  assert.doesNotThrow(() => assertTransition("TASK", "VERIFYING", "VERIFIED"));
});

test("candidate cannot skip certification", () => {
  assert.throws(() => assertTransition("CANDIDATE", "SELECTED", "PROMOTED"), /INVALID_CANDIDATE_TRANSITION/);
  assert.doesNotThrow(() => assertTransition("CANDIDATE", "CERTIFIED", "PROMOTED"));
});

test("stale lease is fail-closed", () => {
  const lease = { ownerId: "agent-1", token: "lease-1", acquiredAtMs: 100, expiresAtMs: 200 };
  assert.doesNotThrow(() => assertLeaseOwner(lease, "agent-1", "lease-1", 150));
  assert.throws(() => assertLeaseOwner(lease, "agent-1", "lease-1", 250), /STALE_OR_INVALID_LEASE/);
});

test("blind retry is denied when failure identity is unchanged", () => {
  assert.deepEqual(
    decideRetry({ attempts: 1, maxAttempts: 3, retryable: true, failureFingerprint: "E_TIMEOUT", previousFailureFingerprint: "E_TIMEOUT" }),
    { allowed: false, reason: "SAME_FAILURE" },
  );
  assert.deepEqual(
    decideRetry({ attempts: 1, maxAttempts: 3, retryable: true, failureFingerprint: "E_TIMEOUT_2", previousFailureFingerprint: "E_TIMEOUT" }),
    { allowed: true, reason: "RETRYABLE" },
  );
});

test("SHA drift makes evidence stale", () => {
  const evidence = { testedSha: "sha-a", runtimeSha: "sha-a", sourceSha: "sha-a", createdAtMs: 1, status: "CURRENT" as const };
  assert.equal(classifyEvidence(evidence, "sha-a"), "CURRENT");
  assert.equal(classifyEvidence(evidence, "sha-b"), "STALE");
});

test("promotion requires red team, opponent, certification and exact SHA lineage", () => {
  const good = {
    candidateState: "CERTIFIED" as const, testedSha: "sha-a", runtimeSha: "sha-a", certifiedSha: "sha-a",
    redTeam: "PASS" as const, opponent: "PASS" as const, certification: "PASS" as const,
  };
  assert.equal(canPromote(good, "sha-a"), true);
  assert.equal(canPromote({ ...good, opponent: "FAIL" }, "sha-a"), false);
  assert.equal(canPromote({ ...good, certifiedSha: "sha-old" }, "sha-a"), false);
});

test("promoted memory must be current, proven and useful", () => {
  const memory = {
    id: "m1", sourceSha: "sha-a", status: "PROMOTED" as const, usable: true, confidence: 90,
    provenance: ["task-1", "evidence-1"], updatedAtMs: 100,
  };
  assert.equal(isMemoryActionable(memory, "sha-a"), true);
  assert.equal(isMemoryActionable({ ...memory, sourceSha: "sha-old" }, "sha-a"), false);
  assert.equal(isMemoryActionable({ ...memory, provenance: [] }, "sha-a"), false);
});

test("wake-only guardian wakes stale working agents", () => {
  assert.equal(
    guardianDecision({ agentState: "WORKING", nowMs: 200, lastSeenMs: 100, heartbeatTimeoutMs: 50 }),
    "WAKE",
  );
  assert.equal(
    guardianDecision({ agentState: "READY", nowMs: 200, lastSeenMs: 100, heartbeatTimeoutMs: 50 }),
    "OBSERVE",
  );
});

test("frontier scoring is deterministic and penalizes cost/risk", () => {
  const strong = scoreFrontier({
    expectedImprovement: 0.9, probabilityOfSuccess: 0.9, informationGain: 0.8,
    cost: 0.1, risk: 0.1, evidenceBurden: 0.2, reversibility: 0.9,
  });
  const expensive = scoreFrontier({
    expectedImprovement: 0.9, probabilityOfSuccess: 0.9, informationGain: 0.8,
    cost: 0.9, risk: 0.9, evidenceBurden: 0.9, reversibility: 0.1,
  });
  assert.ok(strong > expensive);
});
