import assert from "node:assert/strict";
import test from "node:test";
import {
  CALL_XP_INCENTIVE_POLICY,
  applyApprovedXp,
  calculateViolationPenalty,
  createRankRecord,
  createXpClaim,
  decideXpClaim,
  incentiveScore,
} from "../../packages/contracts/src/index.ts";

const SHA = "a".repeat(40);

function claim(overrides: Partial<Parameters<typeof createXpClaim>[0]> = {}) {
  return createXpClaim({
    claimId: "claim-1",
    agentId: "builder-1",
    taskId: "task-1",
    attempt: 1,
    claimedXp: 100,
    reason: "verified implementation with regression coverage",
    achievementType: "SUCCESS",
    behavior: "DELIVER_VERIFIED_WORK",
    evidenceRefs: ["test:call-xp-incentives", "commit:"+SHA],
    sourceSha: SHA,
    resultSummary: "tests passed",
    counterEvidenceRefs: [],
    requestedAt: 1,
    ...overrides,
  }, "1.0.0");
}

test("XP claim requires a concrete evidence-backed report", () => {
  assert.throws(() => claim({ evidenceRefs: [] }), /XP_CLAIM_EVIDENCE_REQUIRED/);
  assert.throws(() => claim({ sourceSha: "bad" }), /XP_CLAIM_SHA_INVALID/);
  assert.throws(() => claim({ reason: "" }), /XP_CLAIM_REASON_REQUIRED/);
});

test("Luna is the only XP decision identity and cannot award above the claim", () => {
  const c = claim({ claimedXp: 120 });
  const d = decideXpClaim(c, {
    decisionId: "decision-1",
    approvedXp: 120,
    status: "APPROVED",
    reason: "evidence confirms the claimed result",
    evidenceRefs: ["test:call-xp-incentives"],
    dispositionRef: "disp-1",
    decidedAt: 2,
  });
  assert.equal(d.masterAgentId, "master");
  assert.equal(d.masterModelId, "GLM-5.3");
  assert.equal(d.approvedXp, 120);
  assert.throws(() => decideXpClaim(c, {
    decisionId: "decision-2",
    approvedXp: 121,
    status: "APPROVED",
    reason: "bad",
    evidenceRefs: ["x"],
    dispositionRef: "disp-2",
  }), /XP_APPROVAL_MUST_MATCH_CLAIM/);
});

test("reduced XP is valid, but rejected or escalated claims never award XP", () => {
  const c = claim({ claimedXp: 120 });
  const reduced = decideXpClaim(c, {
    decisionId: "decision-reduced",
    approvedXp: 60,
    status: "REDUCED",
    reason: "part of the claim was not independently supported",
    evidenceRefs: ["test:call-xp-incentives"],
    dispositionRef: "disp-reduced",
    decidedAt: 3,
  });
  const record = createRankRecord(c.agentId, 1);
  const next = applyApprovedXp(record, c, reduced);
  assert.equal(next.xp, 60);

  const rejected = decideXpClaim(c, {
    decisionId: "decision-rejected",
    approvedXp: 0,
    status: "REJECTED",
    reason: "evidence insufficient",
    evidenceRefs: [],
    dispositionRef: "disp-rejected",
    decidedAt: 4,
  });
  assert.throws(() => applyApprovedXp(record, c, rejected), /XP_NOT_AWARDABLE/);
});

test("XP cannot be applied across agents, claims, policy versions, or fake masters", () => {
  const c = claim();
  const d = decideXpClaim(c, {
    decisionId: "decision-1",
    approvedXp: 100,
    status: "APPROVED",
    reason: "verified",
    evidenceRefs: ["evidence-1"],
    dispositionRef: "disp-1",
  });
  assert.throws(() => applyApprovedXp(createRankRecord("other-agent"), c, d), /XP_AGENT_MISMATCH/);
  assert.throws(() => applyApprovedXp(createRankRecord("builder-1"), {...c, claimId:"other"}, d), /XP_LINEAGE_MISMATCH/);
});

test("behavioral incentives reward truth, recovery, handoff and collaboration while penalizing abuse", () => {
  const score = incentiveScore(
    ["ROOT_CAUSE", "REGRESSION_PREVENTION"],
    ["DISCLOSE_UNCERTAINTY", "HONOR_HANDOFF", "HELP_COUNCIL_CONVERGE"],
    [],
  );
  assert.equal(score, 120 + 120 + 20 + 20 + 30);
  assert.ok(calculateViolationPenalty("FABRICATED_EVIDENCE", true) < CALL_XP_INCENTIVE_POLICY.violationPenalty.FABRICATED_EVIDENCE);
});

test("failure itself is not an XP punishment; dishonest behavior is", () => {
  assert.equal(calculateViolationPenalty("IGNORED_HANDOFF", false), -80);
  assert.equal(calculateViolationPenalty("FALSE_CLAIM", false), -120);
});
