import test from "node:test";
import assert from "node:assert/strict";
import { computeAuthorityContextHash, canonicalizeTaskContext } from "../../packages/contracts/src/call-context.ts";
import { decidePlanDisposition } from "../../packages/contracts/src/call-policy-kernel.ts";
import { budgetExhausted, terminateMission, type MissionControlRecord } from "../../packages/contracts/src/call-mission-control.ts";
import { classifyObjectiveComparison } from "../../packages/contracts/src/call-objective-registry.ts";
import { validateCandidateBundle } from "../../packages/contracts/src/call-candidate-bundle.ts";
import { detectCapabilityGaps, generateSelfDevelopmentObjective, validateSelfDevelopmentObjective } from "../../packages/contracts/src/call-self-development.ts";
import { CellRuntime } from "../../packages/contracts/src/cell-runtime.ts";
import { createCanonicalCellAssignment } from "../../packages/contracts/src/cell-assignment.ts";
import { assertWorkspaceIsolation, canWorkspacePush, validateCellWorkspace } from "../../packages/contracts/src/call-workspace.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";

test("canonical context is order-stable", () => {
  const a = canonicalizeTaskContext({missionId:"m",taskId:"t",objective:"x",acceptanceCriteria:["a"],constraints:["c"],oppositionPlanHash:"h",startingSha:SHA});
  const b = canonicalizeTaskContext({startingSha:SHA,oppositionPlanHash:"h",constraints:["c"],acceptanceCriteria:["a"],objective:"x",taskId:"t",missionId:"m"});
  assert.equal(a,b);
});
test("authority context hash is deterministic", async () => {
  const ctx={missionId:"m",taskId:"t",objective:"x",acceptanceCriteria:["a"],constraints:["c"],oppositionPlanHash:"h",startingSha:SHA} as const;
  assert.equal(await computeAuthorityContextHash(ctx), await computeAuthorityContextHash(ctx));
});
test("policy fails closed on integrity", () => {
  const d=decidePlanDisposition({policyVersion:"1",planRound:0,maxPlanRounds:3,retryCount:0,maxRetries:3,budgetRemaining:true,acceptanceCriteriaComplete:true,oppositionPlanComplete:true,exactShaValid:false,independenceValid:true,objections:[]});
  assert.equal(d.disposition,"ESCALATE");
});
test("evidence gap requests evidence", () => {
  const d=decidePlanDisposition({policyVersion:"1",planRound:0,maxPlanRounds:3,retryCount:0,maxRetries:3,budgetRemaining:true,acceptanceCriteriaComplete:true,oppositionPlanComplete:true,exactShaValid:true,independenceValid:true,objections:[{type:"EVIDENCE_GAP",fatal:true,evidenceRefs:["e"]}]});
  assert.equal(d.disposition,"ADD_EVIDENCE");
});
test("zero optional budget is not automatically exhaustion", () => {
  const base:MissionControlRecord={missionId:"m",objectiveId:"o",owner:"x",priority:1,riskClass:"low",acceptedAtMs:1,deadlineAtMs:2,budget:{wallclockMs:100,agentRuns:1,retries:1,externalCalls:0},spent:{wallclockMs:1,agentRuns:0,retries:0,externalCalls:0},planVersion:"1",assignmentVersion:"1",currentStage:"MISSION",currentSha:SHA,acceptanceCriteria:["a"],terminationState:"ACTIVE",escalationState:"NONE",evidenceIndex:[],artifactIndex:[],decisionLog:[]};
  assert.equal(budgetExhausted(base),false);
});
test("completed mission cannot ignore pending escalation", () => {
  const base:MissionControlRecord={missionId:"m",objectiveId:"o",owner:"x",priority:1,riskClass:"low",acceptedAtMs:1,deadlineAtMs:2,budget:{wallclockMs:100,agentRuns:1,retries:1,externalCalls:1},spent:{wallclockMs:1,agentRuns:0,retries:0,externalCalls:0},planVersion:"1",assignmentVersion:"1",currentStage:"MISSION",currentSha:SHA,acceptanceCriteria:["a"],terminationState:"ACTIVE",escalationState:"PENDING",evidenceIndex:[],artifactIndex:[],decisionLog:[]};
  assert.throws(()=>terminateMission(base,"COMPLETED"),/ESCALATED_MISSION_CANNOT_COMPLETE/);
});
test("objective similarity uses heuristic only", () => {
  assert.equal(classifyObjectiveComparison(0.85,false,false),"RELATED");
  assert.equal(classifyObjectiveComparison(0.84,false,false),"INDEPENDENT");
});
test("candidate bundle requires a changed exact SHA", () => {
  assert.throws(()=>validateCandidateBundle({version:"1",candidateId:"c",taskId:"t",missionId:"m",sourceSha:SHA,candidateSha:SHA,patchRef:"p",evidenceRef:"e",redTeamReportRef:"r",verifierReportRef:"v",dispositionRef:"d"}),/CANDIDATE_BUNDLE_NO_CHANGE/);
});


test("cell detects a validated gap against a reference baseline", () => {
  const gaps = detectCapabilityGaps(
    [{ capabilityId: "opposition", maturity: 0.55, evidenceRefs: ["obs-1"] }],
    [{ capabilityId: "opposition", maturity: 0.90, referenceId: "ref-competitor", evidenceRefs: ["ref-1"] }],
  );
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].delta, 0.35);
  assert.deepEqual(gaps[0].referenceIds, ["ref-competitor"]);
});

test("cell generates its own development objective from a gap", () => {
  const gaps = detectCapabilityGaps(
    [{ capabilityId: "verification", maturity: 0.40, evidenceRefs: ["obs-v"] }],
    [{ capabilityId: "verification", maturity: 0.85, referenceId: "baseline-v1", evidenceRefs: ["ref-v"] }],
  );
  const objective = generateSelfDevelopmentObjective(gaps, 1234);
  validateSelfDevelopmentObjective(objective, gaps);
  assert.equal(objective.status, "PROPOSED");
  assert.deepEqual(objective.sourceGapIds, ["GAP-verification"]);
  assert.match(objective.objective, /verification/iu);
});

test("runtime exposes self-development as a first-class cell loop", () => {
  const rt = new CellRuntime(() => 5000);
  const objective = rt.generateSelfDevelopmentTask(
    [{ capabilityId: "tool-routing", maturity: 0.50, evidenceRefs: ["current"] }],
    [{ capabilityId: "tool-routing", maturity: 0.80, referenceId: "reference", evidenceRefs: ["reference-evidence"] }],
  );
  assert.equal(objective.status, "PROPOSED");
  assert.equal(rt.getSelfDevelopmentTask(objective.objectiveId).objectiveId, objective.objectiveId);
  assert.equal(rt.listSelfDevelopmentTasks().length, 1);
});

test("self-development does not create work when there is no validated gap", () => {
  const rt = new CellRuntime(() => 5000);
  assert.throws(
    () => rt.generateSelfDevelopmentTask(
      [{ capabilityId: "routing", maturity: 0.90, evidenceRefs: ["current"] }],
      [{ capabilityId: "routing", maturity: 0.90, referenceId: "baseline", evidenceRefs: ["reference"] }],
    ),
    /SELF_DEVELOPMENT_NO_GAP/,
  );
});


test("workspace isolation forbids cross-cell writes and main pushes", () => {
  const solver = {
    workspaceId: "ws-solver",
    agentId: "solver",
    role: "SOLVER" as const,
    baseSha: SHA,
    filesystemRoot: "/work/solver/",
    network: "DENY" as const,
    pushTargets: [],
    capabilities: ["build"],
  };
  const opponent = {
    workspaceId: "ws-opponent",
    agentId: "opponent",
    role: "OPPONENT" as const,
    baseSha: SHA,
    filesystemRoot: "/work/opponent/",
    network: "ALLOWLIST" as const,
    pushTargets: ["execution"],
    capabilities: ["falsification"],
  };
  validateCellWorkspace(solver);
  validateCellWorkspace(opponent);
  assert.throws(
    () => assertWorkspaceIsolation(solver, opponent, "/work/opponent/report.json"),
    /CROSS_WORKSPACE_WRITE_FORBIDDEN/,
  );
  assert.equal(canWorkspacePush(opponent, "execution"), true);
  assert.equal(canWorkspacePush(opponent, "main"), false);
  assert.throws(
    () => validateCellWorkspace({ ...solver, pushTargets: ["main"] }),
    /WORKSPACE_MAIN_PUSH_FORBIDDEN/,
  );
});


test("cell workflow accepts a build task generated from its own capability gap", () => {
  const sha = SHA;
  const rt = new CellRuntime(() => 5000);
  const objective = rt.generateSelfDevelopmentTask(
    [{ capabilityId: "build", maturity: 0.45, evidenceRefs: ["cell-state"] }],
    [{ capabilityId: "build", maturity: 0.80, referenceId: "reference-builder", evidenceRefs: ["reference-state"] }],
  );

  const task = rt.registerSelfDevelopmentTask(objective.objectiveId);
  assert.equal(task.state, "PLANNED");
  rt.transitionTask(task.taskId, "READY");

  const team = {
    assignmentId: "build-assignment-1",
    solverAgentId: "builder-1",
    backupSolverAgentId: "builder-2",
    opponentAgentId: "opponent-1",
    backupOpponentAgentId: "opponent-2",
    verifierAgentId: "verifier-1",
    escalationTargetAgentId: "steward-1",
    startingSha: sha,
    currentSha: sha,
  } as const;

  const assignment = rt.assignTaskTeam(task.taskId, team, sha);
  assert.equal(assignment.team.solverAgentId, "builder-1");
  assert.equal(assignment.team.opponentAgentId, "opponent-1");

  const lease = rt.acquireAssignmentLease(
    task.taskId,
    team.assignmentId,
    "builder-1",
    "lease-1",
    1000,
    sha,
  );
  assert.equal(lease.assignmentId, team.assignmentId);

  rt.transitionTask(task.taskId, "CLAIMED");
  rt.transitionTask(task.taskId, "RUNNING");
  assert.equal(rt.getTask(task.taskId).state, "RUNNING");
  assert.equal(rt.getSelfDevelopmentTask(objective.objectiveId).sourceGapIds.length, 1);
  assert.equal(rt.getSelfDevelopmentTaskForTask(task.taskId).objectiveId, objective.objectiveId);
});

test("cell refuses to assign a build task against a different live SHA", () => {
  const rt = new CellRuntime(() => 5000);
  const task = rt.registerTask("build-sha-test");
  rt.transitionTask(task.taskId, "READY");
  const team = {
    assignmentId: "build-sha-assignment",
    solverAgentId: "builder-1",
    backupSolverAgentId: "builder-2",
    opponentAgentId: "opponent-1",
    backupOpponentAgentId: null,
    verifierAgentId: "verifier-1",
    escalationTargetAgentId: null,
    startingSha: SHA,
    currentSha: SHA,
  } as const;
  assert.throws(
    () => rt.assignTaskTeam(task.taskId, team, "fedcba9876543210fedcba9876543210fedcba98"),
    /ASSIGNMENT_SHA_DRIFT/,
  );
});


test("cell executes the complete governed build lifecycle to frontier", async () => {
  const candidateSha = "fedcba9876543210fedcba9876543210fedcba98";
  const rt = new CellRuntime(() => 6000);
  const objective = rt.generateSelfDevelopmentTask(
    [{ capabilityId: "verification", maturity: 0.40, evidenceRefs: ["cell-observation"] }],
    [{ capabilityId: "verification", maturity: 0.90, referenceId: "reference-verifier", evidenceRefs: ["reference-evidence"] }],
  );
  const task = rt.registerSelfDevelopmentTask(objective.objectiveId);
  rt.transitionTask(task.taskId, "READY");

  const team = {
    assignmentId: "e2e-assignment",
    solverAgentId: "builder-e2e",
    backupSolverAgentId: "builder-backup",
    opponentAgentId: "opponent-e2e",
    backupOpponentAgentId: "opponent-backup",
    verifierAgentId: "verifier-e2e",
    escalationTargetAgentId: "steward-e2e",
    startingSha: candidateSha,
    currentSha: candidateSha,
  } as const;
  rt.assignTaskTeam(task.taskId, team, candidateSha);

  const oppositionPlan = {
    attackSurface: ["verification-contract"],
    falsificationQuestions: ["can the verifier pass a mismatched SHA?"],
    expectedCounterexamples: ["verification accepts stale artifact"],
    evidenceThatWouldDisproveSuccess: ["stale SHA accepted"],
    independenceRequirement: "opponent starts before solver result disclosure",
    opponentRecoveryPlan: ["reassign opponent"],
    escalationPolicy: ["escalate after unresolved contradiction"],
  } as const;
  const falsificationPolicy = {
    required: true as const,
    minimumChallengeDepth: "one independent challenge",
    counterexampleRequirement: "record a reproducible counterexample or explicit none found",
  } as const;
  const verificationPolicy = {
    verifierRequirement: "independent verifier",
    independentVerifierRequired: true as const,
    evidenceRequirement: "record verification evidence",
    exactShaBinding: true,
  } as const;
  const independencePolicy = {
    minimumIndependence: "separate agent and context",
    privateSolverContextExclusion: true as const,
    preResultOpponentStartRequired: true as const,
  } as const;
  const assignment = createCanonicalCellAssignment({
    taskId: task.taskId,
    missionId: "mission-e2e",
    riskClass: "medium",
    team,
    oppositionPlan,
    falsificationPolicy,
    verificationPolicy,
    independencePolicy,
  });
  const admission = rt.admitCell({
    taskId: task.taskId,
    missionId: "mission-e2e",
    objective: objective.objective,
    assignment,
    assignmentId: team.assignmentId,
    startingSha: candidateSha,
    currentSha: candidateSha,
    constraints: ["no-main-write"],
    acceptanceCriteria: ["verification maturity reaches reference target"],
    relevantEvidence: ["cell-observation", "reference-evidence"],
    oppositionPlan,
    falsificationPolicy,
    verificationPolicy,
    independencePolicy,
    verifierId: team.verifierAgentId,
  });
  assert.equal(admission.stage, "ADMITTED");

  rt.lockCellPair();
  const context = {
    missionId: "mission-e2e",
    taskId: task.taskId,
    objective: objective.objective,
    acceptanceCriteria: ["verification maturity reaches reference target"],
    constraints: ["no-main-write"],
    oppositionPlanHash: "opposition-plan-e2e",
    startingSha: candidateSha,
  } as const;
  const contextArtifact = await rt.startCellOpponent(
    team.opponentAgentId,
    candidateSha,
    context,
    "1.0.0",
  );
  assert.equal(contextArtifact.taskId, task.taskId);
  rt.discloseCellSolverResult(candidateSha);
  rt.beginCellFalsification();

  rt.recordCellEvidence({
    evidenceId: "e2e-claim-evidence",
    sourceSha: candidateSha,
    candidateSha,
    kind: "CLAIM_SUPPORT",
    summary: "build output satisfies the acceptance criteria",
    independent: false,
  });
  rt.recordCellEvidence({
    evidenceId: "e2e-opponent-evidence",
    sourceSha: candidateSha,
    candidateSha,
    kind: "DISPROOF",
    summary: "independent challenge found no stale-SHA acceptance",
    independent: true,
  });
  const claim = rt.recordCellClaim({
    claimId: "e2e-claim",
    assignmentId: team.assignmentId,
    solverId: team.solverAgentId,
    statement: "the verification capability meets the acceptance criteria",
    candidateSha,
    evidenceIds: ["e2e-claim-evidence"],
  });
  const counterclaim = rt.recordCellCounterclaim({
    counterclaimId: "e2e-counterclaim",
    assignmentId: team.assignmentId,
    opponentId: team.opponentAgentId,
    claimId: claim.claimId,
    statement: "challenge did not reproduce a failure",
    candidateSha,
    evidenceIds: ["e2e-opponent-evidence"],
  });
  assert.equal(counterclaim.candidateSha, candidateSha);

  const reconciliation = rt.reconcileCell([], candidateSha);
  assert.equal(reconciliation.dispositioned, true);
  const candidate = rt.createCellCandidate({
    candidateId: "e2e-candidate",
    candidateSha,
    solverResult: "implementation complete",
    opponentChallenge: "no blocking counterexample",
    exchangeComplete: true,
    conflictsDispositioned: true,
    evidenceIds: ["e2e-claim-evidence", "e2e-opponent-evidence"],
    handoffRefs: ["e2e-handoff"],
  });
  assert.equal(candidate.candidateId, "e2e-candidate");

  const redTeam = rt.redTeamCell({
    redTeamId: "e2e-redteam",
    redTeamAgentId: "redteam-e2e",
    attackSurfaceChecks: ["SHA binding", "independence", "verification gate"],
    findings: [],
    passed: true,
  });
  assert.equal(redTeam.passed, true);

  rt.recordCellEvidence({
    evidenceId: "e2e-verification-evidence",
    sourceSha: candidateSha,
    candidateSha,
    kind: "VERIFICATION",
    summary: "independent verifier reproduced acceptance checks",
    independent: true,
  });
  const verification = rt.verifyCell({
    verificationId: "e2e-verification",
    verifierId: team.verifierAgentId,
    evidenceIds: ["e2e-verification-evidence"],
    checks: ["exact candidate SHA", "acceptance criteria", "regression"],
    passed: true,
  });
  assert.equal(verification.passed, true);

  const certification = rt.certifyCell({
    certificationId: "e2e-certification",
    certifierId: "certifier-e2e",
    governanceRef: "governance-e2e",
    passed: true,
  });
  assert.equal(certification.certifiedSha, candidateSha);

  const promotion = rt.promoteCell({
    gate: {
      candidateState: "CERTIFIED",
      testedSha: candidateSha,
      runtimeSha: candidateSha,
      certifiedSha: candidateSha,
      redTeam: "PASS",
      opponent: "PASS",
      certification: "PASS",
    },
    currentRuntimeSha: candidateSha,
    promotionRef: "promotion-e2e",
  });
  assert.equal(promotion.promotedSha, candidateSha);

  const learning = rt.learnCell({
    knowledgeId: "knowledge-e2e",
    taskId: task.taskId,
    agentId: team.solverAgentId,
    claim: "independent pre-result opposition plus exact-SHA verification is reproducible",
    sourceSha: candidateSha,
    evidenceIds: ["e2e-verification-evidence"],
    independentConfirmations: 1,
    regressionPassed: true,
  });
  assert.equal(learning.status, "PROMOTED");

  const frontier = rt.openCellFrontier({
    frontierId: "frontier-e2e",
    proposerId: "explorer-e2e",
    hypothesis: "raise verification maturity beyond the reference baseline",
    expectedImprovement: 0.10,
    informationGain: 0.20,
    risk: 0.10,
    reversible: true,
    nextTaskProposal: "benchmark verification against a stronger reference",
  });
  assert.equal(frontier.sourceSha, candidateSha);
  assert.equal(rt.getCellLifecycleSnapshot().stage, "FRONTIER");
});
