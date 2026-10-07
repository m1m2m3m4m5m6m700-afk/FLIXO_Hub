import assert from "node:assert/strict";
import test from "node:test";
import {
  CellLifecycleRuntime,
  createCellAdmissionRecord,
  validateCellAdmission,
  type CellAdmissionEnvelope,
} from "../../../packages/contracts/src/cell-lifecycle.ts";
import { CellRuntime } from "../../../packages/contracts/src/cell-runtime.ts";
import { createCanonicalCellAssignment } from "../../../packages/contracts/src/cell-assignment.ts";

const SHA = "a".repeat(40);

function makeEnvelope(): CellAdmissionEnvelope {
  const oppositionPlan = {
    attackSurface: ["acceptance boundary", "failure recovery"],
    falsificationQuestions: ["what evidence would disprove success?"],
    expectedCounterexamples: ["invalid input", "stale artifact"],
    evidenceThatWouldDisproveSuccess: ["reproducible failing case"],
    independenceRequirement: "distinct solver/opponent context",
    opponentRecoveryPlan: ["activate backup opponent and restart independent challenge"],
    escalationPolicy: ["escalate on unresolved material dispute"],
  } as const;
  const falsificationPolicy = {
    required: true as const,
    minimumChallengeDepth: "one independent challenge cycle",
    counterexampleRequirement: "record counterexample or explicit no-counterexample result",
  } as const;
  const verificationPolicy = {
    verifierRequirement: "independent verifier",
    independentVerifierRequired: true as const,
    evidenceRequirement: "exact-SHA reproducible evidence",
    exactShaBinding: true,
  } as const;
  const independencePolicy = {
    minimumIndependence: "distinct identity and context boundary",
    privateSolverContextExclusion: true as const,
    preResultOpponentStartRequired: true as const,
  } as const;
  const assignment = createCanonicalCellAssignment({
    taskId: "task-100",
    missionId: "mission-100",
    riskClass: "HIGH",
    team: {
      assignmentId: "team-100",
      solverAgentId: "solver-100",
      backupSolverAgentId: "solver-backup-100",
      opponentAgentId: "opponent-100",
      backupOpponentAgentId: "opponent-backup-100",
      verifierAgentId: "verifier-100",
      escalationTargetAgentId: "arbiter-100",
      startingSha: SHA,
      currentSha: SHA,
    },
    oppositionPlan,
    falsificationPolicy,
    verificationPolicy,
    independencePolicy,
  });

  return {
    taskId: "task-100",
    missionId: "mission-100",
    objective: "produce a verified candidate",
    assignmentId: "team-100",
    startingSha: SHA,
    currentSha: SHA,
    assignment,
    constraints: ["stay on execution", "exact SHA only"],
    acceptanceCriteria: ["candidate is reproducible", "red team passes", "independent verifier passes"],
    relevantEvidence: ["spec:100"],
    oppositionPlan,
    falsificationPolicy,
    verificationPolicy,
    independencePolicy,
    verifierId: "verifier-100",
  };
}

test("CELL admission fails closed and records a complete immutable envelope", () => {
  const envelope = makeEnvelope();
  assert.doesNotThrow(() => validateCellAdmission(envelope));
  const record = createCellAdmissionRecord(envelope, 1, 1234);
  assert.equal(record.stage, "ADMITTED");
  assert.equal(record.taskId, envelope.taskId);
  assert.equal(record.assignmentId, envelope.assignmentId);
  assert.deepEqual(record.acceptanceCriteria, envelope.acceptanceCriteria);
  assert.equal(record.verifierId, "verifier-100");

  assert.throws(
    () => validateCellAdmission({ ...envelope, acceptanceCriteria: [] }),
    /CELL_ADMISSION_ACCEPTANCE_REQUIRED/,
  );
  assert.throws(
    () => validateCellAdmission({ ...envelope, assignmentId: "wrong-team" }),
    /CELL_ADMISSION_ASSIGNMENT_MISMATCH/,
  );
  assert.throws(() => validateCellAdmission({ ...envelope, verifierId: "" }), /CELL_ADMISSION_VERIFIER_REQUIRED/);
  assert.doesNotThrow(() => validateCellAdmission({ ...envelope, verifierId: "other-verifier" }));
  assert.throws(() => validateCellAdmission({ ...envelope, verifierId: "solver-100" }), /CELL_ADMISSION_VERIFIER_IDENTITY_COLLISION/);
});

test("CELL runtime executes one canonical flow from admission through frontier", () => {
  const rt = new CellRuntime(() => 1000);
  const envelope = makeEnvelope();

  rt.admitCell(envelope);
  assert.equal(rt.getCellLifecycleSnapshot().stage, "ADMITTED");

  rt.lockCellPair();
  assert.equal(rt.getCellLifecycleSnapshot().stage, "PAIR_LOCKED");

  rt.startCellOpponent("opponent-100", SHA, "c".repeat(64));
  assert.equal(rt.getCellLifecycleSnapshot().stage, "OPPONENT_STARTED");

  rt.discloseCellSolverResult(SHA);
  let snapshot = rt.getCellLifecycleSnapshot();
  assert.equal(snapshot.stage, "SOLVING");
  assert.ok(snapshot.opponentStartSequence! < snapshot.solverDisclosureSequence!);
  assert.equal(snapshot.opponentContextHash, "c".repeat(64));
  assert.equal(snapshot.opponentStartedAtMs, 1000);

  rt.beginCellFalsification();
  rt.recordCellClaim({
    claimId: "claim-100",
    assignmentId: "team-100",
    solverId: "solver-100",
    statement: "candidate meets the acceptance boundary",
    candidateSha: SHA,
    evidenceIds: ["e-claim"],
  });
  rt.recordCellEvidence({
    evidenceId: "e-claim",
    sourceSha: SHA,
    candidateSha: SHA,
    kind: "CLAIM_SUPPORT",
    summary: "reproducible acceptance result",
    independent: false,
  });

  rt.recordCellCounterclaim({
    counterclaimId: "counter-100",
    assignmentId: "team-100",
    opponentId: "opponent-100",
    claimId: "claim-100",
    statement: "verify the boundary against a stale-artifact case",
    candidateSha: SHA,
    evidenceIds: ["e-counter"],
  });
  rt.recordCellEvidence({
    evidenceId: "e-counter",
    sourceSha: SHA,
    candidateSha: SHA,
    kind: "DISPROOF",
    summary: "stale-artifact case was checked",
    independent: true,
  });

  rt.reconcileCell([], SHA);
  rt.createCellCandidate({
    candidateId: "candidate-100",
    candidateSha: SHA,
    solverResult: "acceptance criteria satisfied",
    opponentChallenge: "stale-artifact case addressed",
    exchangeComplete: true,
    conflictsDispositioned: true,
    evidenceIds: ["e-claim", "e-counter"],
    handoffRefs: ["handoff:candidate-100"],
  });

  rt.redTeamCell({
    redTeamId: "red-100",
    redTeamAgentId: "red-team-100",
    attackSurfaceChecks: ["hidden assumptions", "false-green path", "governance bypass"],
    findings: [],
    passed: true,
  });
  assert.equal(rt.getCellLifecycleSnapshot().stage, "VERIFICATION_PENDING");

  rt.verifyCell({
    verificationId: "verify-100",
    verifierId: "verifier-100",
    evidenceIds: ["e-claim", "e-counter"],
    checks: ["artifact", "evidence", "exact SHA"],
    passed: true,
  });
  assert.equal(rt.getCellLifecycleSnapshot().stage, "VERIFIED");

  rt.certifyCell({
    certificationId: "cert-100",
    certifierId: "certifier-100",
    governanceRef: "governance:exact-sha-trust-gate",
    passed: true,
  });
  assert.equal(rt.getCellLifecycleSnapshot().stage, "CERTIFIED");

  rt.promoteCell({
    gate: {
      candidateState: "CERTIFIED",
      testedSha: SHA,
      runtimeSha: SHA,
      certifiedSha: SHA,
      redTeam: "PASS",
      opponent: "PASS",
      certification: "PASS",
    },
    currentRuntimeSha: SHA,
    promotionRef: "promotion:rc-a",
  });
  assert.equal(rt.getCellLifecycleSnapshot().stage, "PROMOTED");

  rt.learnCell({
    knowledgeId: "knowledge-100",
    taskId: "task-100",
    agentId: "solver-100",
    claim: "exact-SHA evidence is reusable only after certification",
    sourceSha: SHA,
    evidenceIds: ["e-claim", "e-counter"],
    independentConfirmations: 1,
    regressionPassed: true,
  });
  assert.equal(rt.getCellLifecycleSnapshot().stage, "LEARNED");

  rt.openCellFrontier({
    frontierId: "frontier-100",
    proposerId: "research-100",
    hypothesis: "the same acceptance can be reduced to a cheaper bounded check",
    expectedImprovement: 0.4,
    informationGain: 0.8,
    risk: 0.1,
    reversible: true,
    nextTaskProposal: "admit a bounded optimization task",
  });
  snapshot = rt.getCellLifecycleSnapshot();
  assert.equal(snapshot.stage, "FRONTIER");
  assert.equal(snapshot.promotion?.promotedSha, SHA);
  assert.equal(snapshot.learning?.sourceSha, SHA);
  assert.equal(snapshot.frontier?.sourceSha, SHA);
});

test("CELL arbitration prevents self-adjudication and requires recorded evidence", () => {
  const lifecycle = new CellLifecycleRuntime(() => 2000);
  const envelope = makeEnvelope();
  lifecycle.admit(envelope);
  lifecycle.lockPair();
  lifecycle.recordOpponentIndependentStart("opponent-100", SHA, "c".repeat(64));
  lifecycle.discloseSolverResult(SHA);
  lifecycle.startFalsification();
  lifecycle.recordClaim({
    claimId: "claim-arb",
    assignmentId: "team-100",
    solverId: "solver-100",
    statement: "claim",
    candidateSha: SHA,
    evidenceIds: ["e-arb-claim"],
  });
  lifecycle.recordEvidence({
    evidenceId: "e-arb-claim",
    sourceSha: SHA,
    candidateSha: SHA,
    kind: "CLAIM_SUPPORT",
    summary: "claim evidence",
    independent: false,
  });
  lifecycle.recordCounterclaim({
    counterclaimId: "counter-arb",
    assignmentId: "team-100",
    opponentId: "opponent-100",
    claimId: "claim-arb",
    statement: "counterclaim",
    candidateSha: SHA,
    evidenceIds: ["e-arb-counter"],
  });
  lifecycle.recordEvidence({
    evidenceId: "e-arb-counter",
    sourceSha: SHA,
    candidateSha: SHA,
    kind: "DISPROOF",
    summary: "counter evidence",
    independent: true,
  });
  lifecycle.reconcile(["material conflict"], SHA);
  assert.equal(lifecycle.getStage(), "ARBITRATING");

  assert.throws(
    () => lifecycle.arbitrate({
      arbitrationId: "arb-bad",
      arbiterId: "solver-100",
      claimId: "claim-arb",
      counterclaimId: "counter-arb",
      evidenceIds: ["e-arb-claim"],
      disposition: "RESOLVED",
      rationale: "self adjudication",
      candidateSha: SHA,
    }),
    /CELL_SELF_ARBITRATION_FORBIDDEN/,
  );

  lifecycle.arbitrate({
    arbitrationId: "arb-good",
    arbiterId: "arbiter-100",
    claimId: "claim-arb",
    counterclaimId: "counter-arb",
    evidenceIds: ["e-arb-claim", "e-arb-counter"],
    disposition: "RESOLVED",
    rationale: "independent review resolved the conflict",
    candidateSha: SHA,
  });
  assert.equal(lifecycle.getStage(), "RECONCILING");
});

test("CELL lifecycle stays exact-SHA and fail-closed across promotion and learning", () => {
  const rt = new CellRuntime();
  const envelope = makeEnvelope();
  rt.admitCell(envelope);
  rt.lockCellPair();
  rt.startCellOpponent("opponent-100", SHA, "c".repeat(64));
  assert.throws(() => rt.discloseCellSolverResult("b".repeat(40)), /CELL_SOLVER_DISCLOSURE_SHA_DRIFT/);

  rt.discloseCellSolverResult(SHA);
  assert.throws(() => rt.discloseCellSolverResult(SHA), /CELL_SOLVER_DISCLOSURE_ALREADY_RECORDED/);
  assert.throws(
    () => rt.promoteCell({
      gate: {
        candidateState: "CERTIFIED",
        testedSha: SHA,
        runtimeSha: SHA,
        certifiedSha: SHA,
        redTeam: "PASS",
        opponent: "PASS",
        certification: "PASS",
      },
      currentRuntimeSha: "b".repeat(40),
      promotionRef: "promotion:drift",
    }),
    /CELL_STAGE_INVALID:SOLVING/,
  );
});


test("CELL replan recovery resets stale downstream state and preserves task/mission", () => {
  const lifecycle = new CellLifecycleRuntime(() => 3000);
  const first = makeEnvelope();
  lifecycle.admit(first);
  lifecycle.lockPair();
  lifecycle.recordOpponentIndependentStart("opponent-100", SHA, "c".repeat(64));
  lifecycle.discloseSolverResult(SHA);
  lifecycle.startFalsification();
  lifecycle.recordClaim({
    claimId: "claim-replan-old",
    assignmentId: "team-100",
    solverId: "solver-100",
    statement: "old claim",
    candidateSha: SHA,
    evidenceIds: ["e-old"],
  });
  lifecycle.recordEvidence({
    evidenceId: "e-old",
    sourceSha: SHA,
    candidateSha: SHA,
    kind: "CLAIM_SUPPORT",
    summary: "old evidence",
    independent: false,
  });
  lifecycle.recordCounterclaim({
    counterclaimId: "counter-replan-old",
    assignmentId: "team-100",
    opponentId: "opponent-100",
    claimId: "claim-replan-old",
    statement: "old counterclaim",
    candidateSha: SHA,
    evidenceIds: ["e-counter-old"],
  });
  lifecycle.recordEvidence({
    evidenceId: "e-counter-old",
    sourceSha: SHA,
    candidateSha: SHA,
    kind: "DISPROOF",
    summary: "old counter evidence",
    independent: true,
  });
  lifecycle.reconcile(["material conflict"], SHA);
  lifecycle.arbitrate({
    arbitrationId: "arb-replan",
    arbiterId: "arbiter-100",
    claimId: "claim-replan-old",
    counterclaimId: "counter-replan-old",
    evidenceIds: ["e-old", "e-counter-old"],
    disposition: "REPLAN",
    rationale: "material conflict requires a fresh assignment",
    candidateSha: SHA,
  });
  assert.equal(lifecycle.getStage(), "ADMITTED");

  const base = makeEnvelope();
  const replanned: CellAdmissionEnvelope = {
    ...base,
    assignmentId: "team-101",
    assignment: Object.freeze({
      ...base.assignment,
      assignmentId: "team-101",
      solverId: "solver-101",
      opponentId: "opponent-101",
      backupSolverId: "solver-backup-101",
      backupOpponentId: "opponent-backup-101",
    }),
  };
  const record = lifecycle.replan(replanned);
  assert.equal(record.taskId, "task-100");
  assert.equal(record.missionId, "mission-100");

  const snapshot = lifecycle.snapshot();
  assert.equal(snapshot.stage, "ADMITTED");
  assert.equal(snapshot.claim, null);
  assert.equal(snapshot.counterclaim, null);
  assert.deepEqual(snapshot.evidence, []);
  assert.equal(snapshot.reconciliation, null);
  assert.equal(snapshot.arbitration, null);
  assert.equal(snapshot.candidate, null);
  assert.equal(snapshot.opponentStartSequence, null);
  assert.equal(snapshot.solverDisclosureSequence, null);
  assert.equal(snapshot.admission?.assignmentId, "team-101");
});

test("CELL replan quarantines every prior artifact identity from replay", () => {
  const lifecycle = new CellLifecycleRuntime(() => 5000);
  const first = makeEnvelope();
  lifecycle.admit(first);
  lifecycle.lockPair();
  lifecycle.recordOpponentIndependentStart("opponent-100", SHA, "c".repeat(64));
  lifecycle.discloseSolverResult(SHA);
  lifecycle.startFalsification();
  lifecycle.recordClaim({
    claimId: "claim-replay-old",
    assignmentId: "team-100",
    solverId: "solver-100",
    statement: "old claim",
    candidateSha: SHA,
    evidenceIds: ["e-replay-old"],
  });
  lifecycle.recordEvidence({
    evidenceId: "e-replay-old",
    sourceSha: SHA,
    candidateSha: SHA,
    kind: "CLAIM_SUPPORT",
    summary: "old evidence",
    independent: false,
  });
  lifecycle.recordCounterclaim({
    counterclaimId: "counter-replay-old",
    assignmentId: "team-100",
    opponentId: "opponent-100",
    claimId: "claim-replay-old",
    statement: "old counterclaim",
    candidateSha: SHA,
    evidenceIds: ["e-counter-replay-old"],
  });
  lifecycle.recordEvidence({
    evidenceId: "e-counter-replay-old",
    sourceSha: SHA,
    candidateSha: SHA,
    kind: "DISPROOF",
    summary: "old counter evidence",
    independent: true,
  });
  lifecycle.reconcile(["material conflict"], SHA);
  lifecycle.arbitrate({
    arbitrationId: "arb-replay-old",
    arbiterId: "arbiter-100",
    claimId: "claim-replay-old",
    counterclaimId: "counter-replay-old",
    evidenceIds: ["e-replay-old", "e-counter-replay-old"],
    disposition: "REPLAN",
    rationale: "fresh assignment required",
    candidateSha: SHA,
  });

  lifecycle.replan({
    ...first,
    assignmentId: "team-101",
    assignment: Object.freeze({
      ...first.assignment,
      assignmentId: "team-101",
      solverId: "solver-101",
      opponentId: "opponent-101",
      backupSolverId: "solver-backup-101",
      backupOpponentId: "opponent-backup-101",
    }),
  });

  lifecycle.lockPair();
  lifecycle.recordOpponentIndependentStart("opponent-101", SHA, "d".repeat(64));
  lifecycle.discloseSolverResult(SHA);
  lifecycle.startFalsification();

  assert.throws(() => lifecycle.recordClaim({
    claimId: "claim-replay-old",
    assignmentId: "team-101",
    solverId: "solver-101",
    statement: "replayed old identity",
    candidateSha: SHA,
    evidenceIds: ["e-new"],
  }), /CELL_CLAIM_ID_RETIRED/);

  assert.throws(() => lifecycle.recordEvidence({
    evidenceId: "e-replay-old",
    sourceSha: SHA,
    candidateSha: SHA,
    kind: "DISPROOF",
    summary: "replayed old evidence",
    independent: true,
  }), /CELL_EVIDENCE_ID_RETIRED/);
});

test("CELL replan retires old artifact identities and forbids cross-attempt replay", () => {
  const lifecycle = new CellLifecycleRuntime(() => 4000);
  const first = makeEnvelope();
  lifecycle.admit(first);
  lifecycle.lockPair();
  lifecycle.recordOpponentIndependentStart("opponent-100", SHA, "c".repeat(64));
  lifecycle.discloseSolverResult(SHA);
  lifecycle.startFalsification();
  lifecycle.recordClaim({
    claimId: "claim-retired",
    assignmentId: "team-100",
    solverId: "solver-100",
    statement: "old claim",
    candidateSha: SHA,
    evidenceIds: ["e-retired"],
  });
  lifecycle.recordEvidence({
    evidenceId: "e-retired",
    sourceSha: SHA,
    candidateSha: SHA,
    kind: "CLAIM_SUPPORT",
    summary: "old evidence",
    independent: false,
  });
  lifecycle.recordCounterclaim({
    counterclaimId: "counter-retired",
    assignmentId: "team-100",
    opponentId: "opponent-100",
    claimId: "claim-retired",
    statement: "old counterclaim",
    candidateSha: SHA,
    evidenceIds: ["e-counter-retired"],
  });
  lifecycle.recordEvidence({
    evidenceId: "e-counter-retired",
    sourceSha: SHA,
    candidateSha: SHA,
    kind: "DISPROOF",
    summary: "old counter evidence",
    independent: true,
  });
  lifecycle.reconcile(["material conflict"], SHA);
  lifecycle.arbitrate({
    arbitrationId: "arb-retired",
    arbiterId: "arbiter-100",
    claimId: "claim-retired",
    counterclaimId: "counter-retired",
    evidenceIds: ["e-retired", "e-counter-retired"],
    disposition: "REPLAN",
    rationale: "fresh assignment required",
    candidateSha: SHA,
  });

  lifecycle.replan({
    ...first,
    assignmentId: "team-replan-1",
    assignment: Object.freeze({
      ...first.assignment,
      assignmentId: "team-replan-1",
      solverId: "solver-replan-1",
      opponentId: "opponent-replan-1",
    }),
  });

  lifecycle.lockPair();
  lifecycle.recordOpponentIndependentStart("opponent-replan-1", SHA, "d".repeat(64));
  lifecycle.discloseSolverResult(SHA);
  lifecycle.startFalsification();

  assert.throws(
    () => lifecycle.recordClaim({
      claimId: "claim-retired",
      assignmentId: "team-replan-1",
      solverId: "solver-replan-1",
      statement: "replayed old identity",
      candidateSha: SHA,
      evidenceIds: ["e-retired"],
    }),
    /CELL_CLAIM_ID_RETIRED/,
  );
  assert.throws(
    () => lifecycle.recordEvidence({
      evidenceId: "e-retired",
      sourceSha: SHA,
      candidateSha: SHA,
      kind: "CLAIM_SUPPORT",
      summary: "replayed old evidence",
      independent: false,
    }),
    /CELL_EVIDENCE_ID_RETIRED/,
  );
});



test("CELL opponent independence proof is immutable, timestamped, and verifier-bound", () => {
  const lifecycle = new CellLifecycleRuntime(() => 4321);
  const envelope = makeEnvelope();
  lifecycle.admit(envelope);
  lifecycle.lockPair();
  lifecycle.recordOpponentIndependentStart("opponent-100", SHA, "d".repeat(64));
  assert.throws(() => lifecycle.recordOpponentIndependentStart("opponent-100", SHA, "e".repeat(64)), /CELL_OPPONENT_START_ALREADY_RECORDED/);
  lifecycle.discloseSolverResult(SHA);
  lifecycle.startFalsification();
  lifecycle.recordClaim({ claimId: "claim-proof", assignmentId: "team-100", solverId: "solver-100", statement: "claim", candidateSha: SHA, evidenceIds: ["e-proof-claim"] });
  lifecycle.recordEvidence({ evidenceId: "e-proof-claim", sourceSha: SHA, candidateSha: SHA, kind: "CLAIM_SUPPORT", summary: "claim proof", independent: false });
  lifecycle.recordCounterclaim({ counterclaimId: "counter-proof", assignmentId: "team-100", opponentId: "opponent-100", claimId: "claim-proof", statement: "counter", candidateSha: SHA, evidenceIds: ["e-proof-counter"] });
  lifecycle.recordEvidence({ evidenceId: "e-proof-counter", sourceSha: SHA, candidateSha: SHA, kind: "DISPROOF", summary: "counter proof", independent: true });
  lifecycle.reconcile([], SHA);
  lifecycle.createCandidate({ candidateId: "candidate-proof", candidateSha: SHA, solverResult: "result", opponentChallenge: "challenge", exchangeComplete: true, conflictsDispositioned: true, evidenceIds: ["e-proof-claim", "e-proof-counter"], handoffRefs: ["handoff:proof"] });
  lifecycle.redTeamReview({ redTeamId: "red-proof", redTeamAgentId: "red-proof-agent", attackSurfaceChecks: ["independence"], findings: [], passed: true });
  assert.throws(() => lifecycle.independentlyVerify({ verificationId: "verify-proof-bad", verifierId: "other-verifier", evidenceIds: ["e-proof-claim"], checks: ["context"], passed: true }), /CELL_VERIFIER_ADMISSION_MISMATCH/);
  const verification = lifecycle.independentlyVerify({ verificationId: "verify-proof", verifierId: "verifier-100", evidenceIds: ["e-proof-claim", "e-proof-counter"], checks: ["context", "ordering", "sha"], passed: true });
  assert.equal(verification.opponentContextHash, "d".repeat(64));
  assert.equal(verification.opponentStartedAtMs, 4321);
});

test("CELL frontier is downstream-only and cannot mutate promotion state", () => {
  const lifecycle = new CellLifecycleRuntime();
  lifecycle.admit(makeEnvelope());
  assert.throws(() => lifecycle.openFrontier({ frontierId: "frontier-before", proposerId: "research", hypothesis: "premature", expectedImprovement: 0.1, informationGain: 0.1, risk: 0.1, reversible: true, nextTaskProposal: "next" }), /CELL_STAGE_INVALID:ADMITTED/);
  assert.equal(lifecycle.snapshot().promotion, null);
});


test("CELL replay matrix rejects candidate, verification, and certification replays fail-closed", () => {
  const lifecycle = new CellLifecycleRuntime(() => 6000);
  const envelope = makeEnvelope();
  lifecycle.admit(envelope);
  lifecycle.lockPair();
  lifecycle.recordOpponentIndependentStart("opponent-100", SHA, "e".repeat(64));
  lifecycle.discloseSolverResult(SHA);
  lifecycle.startFalsification();
  lifecycle.recordClaim({
    claimId: "claim-replay-matrix",
    assignmentId: "team-100",
    solverId: "solver-100",
    statement: "candidate claim",
    candidateSha: SHA,
    evidenceIds: ["e-replay-matrix-claim"],
  });
  lifecycle.recordEvidence({
    evidenceId: "e-replay-matrix-claim",
    sourceSha: SHA,
    candidateSha: SHA,
    kind: "CLAIM_SUPPORT",
    summary: "candidate claim evidence",
    independent: false,
  });
  lifecycle.recordCounterclaim({
    counterclaimId: "counter-replay-matrix",
    assignmentId: "team-100",
    opponentId: "opponent-100",
    claimId: "claim-replay-matrix",
    statement: "candidate challenge",
    candidateSha: SHA,
    evidenceIds: ["e-replay-matrix-counter"],
  });
  lifecycle.recordEvidence({
    evidenceId: "e-replay-matrix-counter",
    sourceSha: SHA,
    candidateSha: SHA,
    kind: "DISPROOF",
    summary: "candidate challenge evidence",
    independent: true,
  });
  lifecycle.reconcile([], SHA);
  lifecycle.createCandidate({
    candidateId: "candidate-replay-matrix",
    candidateSha: SHA,
    solverResult: "candidate result",
    opponentChallenge: "candidate challenge",
    exchangeComplete: true,
    conflictsDispositioned: true,
    evidenceIds: ["e-replay-matrix-claim", "e-replay-matrix-counter"],
    handoffRefs: ["handoff:replay-matrix"],
  });

  assert.throws(
    () => lifecycle.createCandidate({
      candidateId: "candidate-replay-matrix",
      candidateSha: SHA,
      solverResult: "replayed candidate",
      opponentChallenge: "replayed challenge",
      exchangeComplete: true,
      conflictsDispositioned: true,
      evidenceIds: ["e-replay-matrix-claim", "e-replay-matrix-counter"],
      handoffRefs: ["handoff:replay-matrix-replayed"],
    }),
    /CELL_STAGE_INVALID:CANDIDATE/,
  );

  lifecycle.redTeamReview({
    redTeamId: "red-replay-matrix",
    redTeamAgentId: "red-team-replay-matrix",
    attackSurfaceChecks: ["replay"],
    findings: [],
    passed: true,
  });
  lifecycle.independentlyVerify({
    verificationId: "verify-replay-matrix",
    verifierId: "verifier-100",
    evidenceIds: ["e-replay-matrix-claim", "e-replay-matrix-counter"],
    checks: ["candidate replay", "evidence", "exact SHA"],
    passed: true,
  });

  assert.throws(
    () => lifecycle.independentlyVerify({
      verificationId: "verify-replay-matrix",
      verifierId: "verifier-100",
      evidenceIds: ["e-replay-matrix-claim"],
      checks: ["replayed verification"],
      passed: true,
    }),
    /CELL_STAGE_INVALID:VERIFIED/,
  );

  lifecycle.certify({
    certificationId: "cert-replay-matrix",
    certifierId: "certifier-replay-matrix",
    governanceRef: "governance:replay-matrix",
    passed: true,
  });

  assert.throws(
    () => lifecycle.certify({
      certificationId: "cert-replay-matrix",
      certifierId: "certifier-replay-matrix",
      governanceRef: "governance:replay-matrix",
      passed: true,
    }),
    /CELL_STAGE_INVALID:CERTIFIED/,
  );
});
