import test from "node:test";
import assert from "node:assert/strict";
import {
  createCollaborationSession,
  shouldConveneCollaboration,
  selectCollaborationProtocol,
  validateCollaborationMessage,
  assertIndependentViews,
  decideCollaboration,
  isHardCollaborationProtocol,
} from "../../packages/contracts/src/call-collaboration.ts";

test("hard failures convene a multi-agent council", () => {
  assert.equal(shouldConveneCollaboration({
    severity: "HARD", failedAttempts: 0, unresolvedObjections: 0,
    rootCauseConfidence: 0.95, verifierConflict: false,
  }), true);
});

test("protocol selection follows failure shape", () => {
  assert.equal(selectCollaborationProtocol({
    severity: "HARD", verifierConflict: true, failedAttempts: 3, unresolvedObjections: 1,
  }), "VERIFICATION_COUNCIL");
  assert.equal(selectCollaborationProtocol({
    severity: "HARD", verifierConflict: false, failedAttempts: 3, unresolvedObjections: 0,
  }), "ADVERSARIAL_REPAIR");
});

test("hard councils require independent specialist participation", () => {
  const session = createCollaborationSession({
    sessionId: "c1", taskId: "t1", severity: "CRITICAL",
    protocol: "ADVERSARIAL_REPAIR",
    participants: ["master", "builder", "opponent", "adversary-builder", "verifier"],
    startedAt: "2026-10-07T00:00:00Z",
  });
  assert.equal(isHardCollaborationProtocol(session.protocol), true);
  const messages = [
    { messageId:"m1",sessionId:"c1",sender:"builder" as const,recipient:"council" as const,kind:"HYPOTHESIS" as const,claim:"root cause",evidenceRefs:[],baseSha:"sha-a",createdAt:"2026-10-07T00:00:01Z" },
    { messageId:"m2",sessionId:"c1",sender:"opponent" as const,recipient:"council" as const,kind:"COUNTEREXAMPLE" as const,claim:"breaks invariant",evidenceRefs:["ev-2"],baseSha:"sha-a",createdAt:"2026-10-07T00:00:02Z" },
    { messageId:"m3",sessionId:"c1",sender:"verifier" as const,recipient:"council" as const,kind:"EVIDENCE" as const,claim:"test passes",evidenceRefs:["ev-3"],baseSha:"sha-a",createdAt:"2026-10-07T00:00:03Z" },
  ];
  for (const message of messages) validateCollaborationMessage(session, message);
  assertIndependentViews(session, messages);
  const decision = decideCollaboration(session, {
    messages, unresolvedObjections: [], patchAvailable: true, evidenceSufficient: true,
  });
  assert.equal(decision.disposition, "REPAIR");
  assert.deepEqual(decision.supportingEvidence, ["ev-2", "ev-3"]);
});

test("council rejects evidence-free repair claims", () => {
  const session = createCollaborationSession({
    sessionId:"c2", taskId:"t2", severity:"HARD", protocol:"VERIFICATION_COUNCIL",
    participants:["master","builder","opponent","verifier"], startedAt:"2026-10-07T00:00:00Z",
  });
  assert.throws(() => validateCollaborationMessage(session, {
    messageId:"m1",sessionId:"c2",sender:"builder" as const,recipient:"council" as const,
    kind:"PATCH_PROPOSAL" as const,claim:"fixed",evidenceRefs:[],baseSha:"sha-b",
    createdAt:"2026-10-07T00:00:01Z",
  }), /COLLABORATION_EVIDENCE_REQUIRED/);
});

test("deadlock escalates instead of master self-certifying", () => {
  const session = createCollaborationSession({
    sessionId:"c3", taskId:"t3", severity:"CRITICAL", protocol:"DEADLOCK_COUNCIL",
    participants:["master","builder","opponent","verifier"], startedAt:"2026-10-07T00:00:00Z",
  });
  const messages = [
    { messageId:"m1",sessionId:"c3",sender:"builder" as const,recipient:"council" as const,kind:"HYPOTHESIS" as const,claim:"a",evidenceRefs:[],baseSha:"sha-c",createdAt:"2026-10-07T00:00:01Z" },
    { messageId:"m2",sessionId:"c3",sender:"opponent" as const,recipient:"council" as const,kind:"COUNTEREXAMPLE" as const,claim:"b",evidenceRefs:["ev-4"],baseSha:"sha-c",createdAt:"2026-10-07T00:00:02Z" },
    { messageId:"m3",sessionId:"c3",sender:"verifier" as const,recipient:"council" as const,kind:"BLOCKER" as const,claim:"c",evidenceRefs:["ev-5"],baseSha:"sha-c",createdAt:"2026-10-07T00:00:03Z" },
  ];
  const decision = decideCollaboration(session, {
    messages, unresolvedObjections:["contradiction"], patchAvailable:true, evidenceSufficient:true,
  });
  assert.equal(decision.disposition, "ESCALATE");
});
