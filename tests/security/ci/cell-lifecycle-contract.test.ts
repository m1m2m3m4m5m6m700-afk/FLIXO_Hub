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

  assert.throws(
    () => validateCellAdmission({ ...envelope, acceptanceCriteria: [] }),
    /CELL_ADMISSION_ACCEPTANCE_REQUIRED/,
  );
  assert.throws(
    () => validateCellAdmission({ ...envelope, assignmentId: "wrong-team" }),
    /CELL_ADMISSION_ASSIGNMENT_REQUIRED/,
  );
});

test("CELL runtime executes one canonical flow from admission through frontier", () => {
  const rt = new CellRuntime(() => 1000);
  const envelope = makeEnvelope();

  rt.admitCell(envelope);
  assert.equal(rt.getCellLifecycleSnapshot().stage, "ADMITTED");

  rt.lockCellPair();
  assert.equal(rt.getCellLifecycleSnapshot().stage, "PAIR_LOCKED");

  rt.startCellOpponent("opponent-100", SHA);
  assert.equal(rt.getCellLifecycleSnapshot().stage, "OPPONENT_STARTED");

  rt.discloseCellSolverResult(SHA);
  let snapshot = rt.getCellLifecycleSnapshot();
  assert.equal(snapshot.stage, "SOLVING");
  assert.ok(snapshot.opponentStartSequence! < snapshot.solverDisclosureSequence!);

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
  lifecycle.recordOpponentIndependentStart("opponent-100", SHA);
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
  rt.startCellOpponent("opponent-100", SHA);
  assert.throws(() => rt.discloseCellSolverResult("b".repeat(40)), /CELL_SOLVER_DISCLOSURE_SHA_INVALID/);

  rt.discloseCellSolverResult(SHA);
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
