import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldConveneCollaboration,
  selectCollaborationProtocol,
  createCollaborationSession,
  validateCollaborationMessage,
  decideCollaboration,
} from "../../packages/contracts/src/call-collaboration.ts";

function message(sessionId: string, sender: "builder"|"opponent"|"adversary-builder"|"verifier", kind: "HYPOTHESIS"|"COUNTEREXAMPLE"|"PATCH_PROPOSAL"|"EVIDENCE"|"BLOCKER", refs: string[], sha="fixture-sha") {
  return { messageId: sender + "-" + kind, sessionId, sender, recipient:"council" as const, kind, claim:kind, evidenceRefs:refs, baseSha:sha, createdAt:"2026-10-07T00:00:00Z" };
}

test("hard-case benchmark: root-cause uncertainty convenes the council", () => {
  assert.equal(shouldConveneCollaboration({
    severity:"HARD", failedAttempts:1, unresolvedObjections:0,
    rootCauseConfidence:0.42, verifierConflict:false,
  }), true);
  assert.equal(selectCollaborationProtocol({
    severity:"CRITICAL", verifierConflict:false, failedAttempts:0, unresolvedObjections:0,
  }), "ROOT_CAUSE_COUNCIL");
});

test("hard-case benchmark: adversarial repair requires Builder + Opponent + Adversary Builder", () => {
  const s=createCollaborationSession({
    sessionId:"bench-repair",taskId:"bug-001",severity:"HARD",
    protocol:"ADVERSARIAL_REPAIR",
    participants:["master","builder","opponent","adversary-builder","verifier"],
    startedAt:"2026-10-07T00:00:00Z",
  });
  const ms=[
    message(s.sessionId,"builder","PATCH_PROPOSAL",["patch"]),
    message(s.sessionId,"opponent","COUNTEREXAMPLE",["counterexample"]),
    message(s.sessionId,"adversary-builder","EVIDENCE",["mutation"]),
  ];
  ms.forEach(m=>validateCollaborationMessage(s,m));
  const d=decideCollaboration(s,{messages:ms,unresolvedObjections:[],patchAvailable:true,evidenceSufficient:true});
  assert.equal(d.disposition,"REPAIR");
  assert.deepEqual(d.supportingEvidence,["patch","counterexample","mutation"]);
});

test("hard-case benchmark: verifier conflict blocks premature certification", () => {
  const s=createCollaborationSession({
    sessionId:"bench-verify",taskId:"bug-002",severity:"CRITICAL",
    protocol:"VERIFICATION_COUNCIL",
    participants:["master","builder","opponent","verifier"],
    startedAt:"2026-10-07T00:00:00Z",
  });
  const ms=[
    message(s.sessionId,"builder","PATCH_PROPOSAL",["patch"]),
    message(s.sessionId,"opponent","COUNTEREXAMPLE",["counter"]),
    message(s.sessionId,"verifier","BLOCKER",["failed-regression"]),
  ];
  ms.forEach(m=>validateCollaborationMessage(s,m));
  const d=decideCollaboration(s,{messages:ms,unresolvedObjections:["regression"],patchAvailable:true,evidenceSufficient:true});
  assert.equal(d.disposition,"REPLAN");
});

test("hard-case benchmark: evidence gap is a hard block", () => {
  const s=createCollaborationSession({
    sessionId:"bench-evidence",taskId:"bug-003",severity:"HARD",
    protocol:"VERIFICATION_COUNCIL",
    participants:["master","builder","opponent","verifier"],
    startedAt:"2026-10-07T00:00:00Z",
  });
  const ms=[
    message(s.sessionId,"builder","HYPOTHESIS",[]),
    message(s.sessionId,"opponent","COUNTEREXAMPLE",["counter"]),
    message(s.sessionId,"verifier","EVIDENCE",["partial"]),
  ];
  ms.forEach(m=>validateCollaborationMessage(s,m));
  const d=decideCollaboration(s,{messages:ms,unresolvedObjections:[],patchAvailable:true,evidenceSufficient:false});
  assert.equal(d.disposition,"BLOCK");
});

test("hard-case benchmark: SHA drift is rejected at the collaboration boundary", () => {
  const s=createCollaborationSession({
    sessionId:"bench-sha",taskId:"bug-004",severity:"HARD",
    protocol:"ADVERSARIAL_REPAIR",
    participants:["master","builder","opponent","adversary-builder"],
    startedAt:"2026-10-07T00:00:00Z",
  });
  assert.throws(() => validateCollaborationMessage(s,message(s.sessionId,"builder","PATCH_PROPOSAL",["patch"],"")), /COLLABORATION_SHA_REQUIRED/);
});
