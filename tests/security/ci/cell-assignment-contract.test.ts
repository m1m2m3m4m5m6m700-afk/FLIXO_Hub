import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeDelegation,
  decideProgressAction,
  evaluateProgress,
  rankAgentsForTask,
  scoreAgentForTask,
  selectAssignmentQuartet,
  selectAssignmentTeam,
  spawnSubtask,
  delegateHandoff,
  validateAssignmentForTask,
  createCanonicalCellAssignment,
  validateCanonicalCellAssignment,
  validateTypedHandoff,
  type AssignmentAgentProfile,
  type AssignmentRequirements,
} from "../../../packages/contracts/src/cell-assignment.ts";

const task: AssignmentRequirements = {
  taskId: "task-1",
  requiredCapabilities: ["verification"],
  requiredOutputTypes: ["counterexample"],
  riskClass: "HIGH",
  writeScope: "tests/**",
  verificationBurden: 0.9,
  informationGain: 0.8,
  independenceRequired: true,
  maxCost: 10,
  startingSha: "1111111111111111111111111111111111111111",
  currentSha: "2222222222222222222222222222222222222222",
};

const agents: AssignmentAgentProfile[] = [
  {
    agentId: "agent-a",
    capabilities: ["verification", "falsification"],
    outputTypes: ["counterexample"],
    riskClasses: ["HIGH"],
    verificationStrength: 0.95,
    reliability: 0.95,
    contextFit: 0.9,
    recoveryQuality: 0.9,
    informationGain: 0.9,
    recentFailureRate: 0.02,
    falsePositiveRate: 0.01,
    falseGreenHistory: 0,
    availability: 0.9,
    costRate: 1,
    state: "READY",
  },
  {
    agentId: "agent-b",
    capabilities: ["verification", "falsification"],
    outputTypes: ["counterexample"],
    riskClasses: ["HIGH"],
    verificationStrength: 0.8,
    reliability: 0.8,
    contextFit: 0.7,
    recoveryQuality: 0.7,
    informationGain: 0.6,
    recentFailureRate: 0.05,
    falsePositiveRate: 0.05,
    falseGreenHistory: 0.02,
    availability: 0.8,
    costRate: 2,
    state: "READY",
  },
  {
    agentId: "agent-c",
    capabilities: ["verification", "falsification"],
    outputTypes: ["counterexample"],
    riskClasses: ["HIGH"],
    verificationStrength: 0.85,
    reliability: 0.78,
    contextFit: 0.75,
    recoveryQuality: 0.72,
    informationGain: 0.65,
    recentFailureRate: 0.05,
    falsePositiveRate: 0.04,
    falseGreenHistory: 0.01,
    availability: 0.9,
    costRate: 3,
    state: "READY",
  },
  {
    agentId: "agent-d",
    capabilities: ["verification"],
    outputTypes: ["counterexample"],
    riskClasses: ["HIGH"],
    verificationStrength: 0.3,
    reliability: 0.4,
    contextFit: 0.2,
    recoveryQuality: 0.2,
    informationGain: 0.2,
    recentFailureRate: 0.3,
    falsePositiveRate: 0.2,
    falseGreenHistory: 0.3,
    availability: 0.9,
    costRate: 1,
    state: "READY",
  },
];

test("routing is task-specific and artifact-aware", () => {
  const ranked = rankAgentsForTask(agents, task);
  assert.equal(ranked[0].agentId, "agent-a");
  assert.ok(
    scoreAgentForTask(agents[0], task).score >
      scoreAgentForTask(agents[3], task).score,
  );
});

test("missing backup is rejected fail-closed", () => {
  const ranked = rankAgentsForTask(agents, task);
  assert.throws(
    () => selectAssignmentQuartet(
      "as-no-backup",
      ranked.slice(0, 1),
      ["agent-c"],
      ["agent-d"],
      true,
      { startingSha: task.startingSha, currentSha: task.currentSha },
    ),
    /ASSIGNMENT_REQUIRES_PRIMARY_AND_BACKUP/,
  );
});

test("high-risk assignment requires an independent verifier", () => {
  const ranked = rankAgentsForTask(agents, task);
  const quartet = selectAssignmentQuartet(
    "as-1",
    ranked,
    ["agent-c"],
    ["agent-d"],
    true,
    { startingSha: task.startingSha, currentSha: task.currentSha },
  );
  assert.equal(quartet.primaryAgentId, "agent-a");
  assert.equal(quartet.backupAgentId, "agent-b");
  assert.equal(quartet.verifierAgentId, "agent-c");
  assert.equal(quartet.escalationTargetAgentId, "agent-d");
});

test("directional delegation enforces edge and budgets", () => {
  const rule = {
    sourceAgentId: "agent-a",
    targetAgentId: "agent-b",
    taskTypes: ["VERIFY"],
    riskClasses: ["HIGH"],
    maxDepth: 1,
    maxActiveSubtasks: 2,
    maxCost: 10,
    maxDurationMs: 1000,
  };

  assert.equal(
    authorizeDelegation([rule], {
      taskId: "task-1",
      sourceAgentId: "agent-a",
      targetAgentId: "agent-b",
      taskType: "VERIFY",
      riskClass: "HIGH",
      depth: 1,
      activeSubtasks: 2,
      estimatedCost: 10,
      estimatedDurationMs: 1000,
    }),
    true,
  );

  assert.equal(
    authorizeDelegation([rule], {
      taskId: "task-1",
      sourceAgentId: "agent-a",
      targetAgentId: "agent-c",
      taskType: "VERIFY",
      riskClass: "HIGH",
      depth: 1,
      activeSubtasks: 1,
      estimatedCost: 1,
      estimatedDurationMs: 100,
    }),
    false,
  );

  assert.equal(
    authorizeDelegation([rule], {
      taskId: "task-1",
      sourceAgentId: "agent-a",
      targetAgentId: "agent-b",
      taskType: "VERIFY",
      riskClass: "HIGH",
      depth: 2,
      activeSubtasks: 1,
      estimatedCost: 1,
      estimatedDurationMs: 100,
    }),
    false,
  );
});

test("spawn produces an independent durable subtask identity", () => {
  const subtask = spawnSubtask("task-1", "sub-1", {
    objective: "produce counterexample",
    contextRefs: ["candidate:c1"],
    requiredCapabilities: ["falsification"],
    expectedOutput: "COUNTEREXAMPLE",
  });

  assert.deepEqual(subtask, {
    subtaskId: "sub-1",
    parentTaskId: "task-1",
    objective: "produce counterexample",
    contextRefs: ["candidate:c1"],
    requiredCapabilities: ["falsification"],
    expectedOutput: "COUNTEREXAMPLE",
  });
});

test("typed handoff rejects unsafe shortcuts", () => {
  const base = {
    handoffId: "h1",
    taskId: "task-1",
    parentTaskId: null,
    assignmentId: "as-1",
    missionId: "mission-1",
    sessionId: "session-1",
    sourceAgentId: "agent-a",
    targetAgentId: "agent-c",
    taskType: "VERIFY",
    riskClass: "HIGH",
    reason: "independent verification",
    objective: "produce counterexample",
    inputRefs: ["candidate:c1"],
    requiredCapabilities: ["falsification"],
    expectedOutput: "counterexample",
    verificationCriteria: ["reproducible evidence"],
    readScope: "tests/**",
    writeScope: "reports/**",
    startingSha: "1111111111111111111111111111111111111111",
    currentSha: "2222222222222222222222222222222222222222",
    deadlineAtMs: null,
    budget: { cost: 2, durationMs: 500 },
    evidenceRequirements: ["exact SHA"],
    returnContract: "return evidence refs",
  };

  assert.doesNotThrow(() => validateTypedHandoff(base));
  assert.throws(
    () => validateTypedHandoff({ ...base, targetAgentId: "agent-a" }),
    /SELF_HANDOFF_FORBIDDEN/,
  );
  assert.throws(
    () => validateTypedHandoff({ ...base, verificationCriteria: [] }),
    /HANDOFF_VERIFICATION_REQUIRED/,
  );
});

test("progress observations drive reassignment and replanning", () => {
  const history = [
    {
      taskId: "task-1",
      assignmentId: "as-1",
      agentId: "agent-a",
      observedAtMs: 0,
      progressPercent: 10,
      usefulOutputCount: 1,
      lastEvidenceAtMs: 0,
      state: "ON_TRACK" as const,
      blocker: null,
      nextAction: "continue",
    },
    {
      taskId: "task-1",
      assignmentId: "as-1",
      agentId: "agent-a",
      observedAtMs: 100,
      progressPercent: 10,
      usefulOutputCount: 1,
      lastEvidenceAtMs: 0,
      state: "ON_TRACK" as const,
      blocker: null,
      nextAction: "inspect",
    },
  ];

  assert.equal(evaluateProgress(history, 200, 500), "SLOW");
  assert.equal(evaluateProgress(history, 700, 500), "STALLED");
  assert.equal(decideProgressAction("SLOW", 0), "REASSIGN");
  assert.equal(decideProgressAction("STALLED", 1), "REASSIGN");
  assert.equal(decideProgressAction("STALLED", 2), "REPLAN");
});

test("assignment team pairs solver with an independent opponent", () => {
  const solverRanked = rankAgentsForTask(agents, task);
  const opponentRanked = [...solverRanked].reverse();
  const team = selectAssignmentTeam({
    assignmentId: "team-1",
    solverRanked,
    opponentRanked,
    verifierCandidates: ["agent-c"],
    escalationCandidates: ["agent-d"],
    requireIndependentVerifier: true,
    lineage: { startingSha: task.startingSha, currentSha: task.currentSha },
  });
  assert.equal(team.solverAgentId, "agent-a");
  assert.notEqual(team.opponentAgentId, team.solverAgentId);
  assert.ok(team.verifierAgentId !== team.solverAgentId);
});

test("independence-key collision is rejected", () => {
  const ranked = rankAgentsForTask(
    agents.map((agent) =>
      agent.agentId === "agent-c"
        ? { ...agent, independenceKey: "agent-a" }
        : agent,
    ),
    task,
  );
  assert.throws(
    () => selectAssignmentQuartet(
      "as-collision",
      ranked,
      ["agent-c"],
      ["agent-d"],
      true,
      { startingSha: task.startingSha, currentSha: task.currentSha },
    ),
    /INDEPENDENT_VERIFIER_COLLISION/,
  );
});

test("solver/opponent shared independence is rejected", () => {
  const ranked = rankAgentsForTask(agents, task);
  assert.throws(
    () => selectAssignmentTeam({
      assignmentId: "team-collision",
      solverRanked: ranked,
       opponentRanked: ranked.filter((candidate) => candidate.agentId !== "agent-d").map((candidate) =>
        candidate.agentId === "agent-d"
          ? { ...candidate, independenceKey: "agent-a" }
          : candidate,
      ),
      verifierCandidates: ["agent-c"],
      escalationCandidates: ["agent-d"],
      requireIndependentVerifier: true,
      lineage: { startingSha: task.startingSha, currentSha: task.currentSha },
    }),
    /ASSIGNMENT_REQUIRES_INDEPENDENT_OPPONENT/,
  );
});

test("verifier/opponent shared independence is rejected", () => {
  const collisionAgents = agents.map((agent) =>
    agent.agentId === "agent-c"
      ? { ...agent, independenceKey: "agent-a" }
      : agent,
  );
  const ranked = rankAgentsForTask(collisionAgents, task);
  assert.throws(
    () => selectAssignmentTeam({
      assignmentId: "team-verifier-collision",
      solverRanked: ranked,
      opponentRanked: ranked.filter((candidate) => candidate.agentId !== "agent-c"),
      verifierCandidates: ["agent-c"],
      escalationCandidates: ["agent-d"],
      requireIndependentVerifier: true,
      lineage: { startingSha: task.startingSha, currentSha: task.currentSha },
    }),
    /INDEPENDENT_VERIFIER_COLLISION|INDEPENDENT_VERIFIER_REQUIRED/,
  );
});

test("wrong routing and SHA drift are fail-closed", () => {
  const ranked = rankAgentsForTask(agents, task);
  const good = selectAssignmentQuartet(
    "as-extra", ranked, ["agent-c"], ["agent-d"], true,
    { startingSha: task.startingSha, currentSha: task.currentSha },
  );
  assert.doesNotThrow(() => validateAssignmentForTask(task, good, agents));
  assert.throws(() => validateAssignmentForTask(task, { ...good, primaryAgentId: "agent-wrong" }, agents), /WRONG_AGENT_ROUTING/);
  assert.throws(() => validateAssignmentForTask(task, { ...good, currentSha: task.startingSha }, agents), /ASSIGNMENT_SHA_DRIFT/);
  assert.throws(() => validateAssignmentForTask(task, { ...good, verifierAgentId: "agent-a" }, agents), /INDEPENDENT_VERIFIER_COLLISION|ASSIGNMENT_ROLE_COLLISION/);
});

test("delegation rejects active/cost/duration overflow and self edges", () => {
  const rule = { sourceAgentId: "agent-a", targetAgentId: "agent-b", taskTypes: ["VERIFY"], riskClasses: ["HIGH"], maxDepth: 1, maxActiveSubtasks: 1, maxCost: 2, maxDurationMs: 500 };
  const base = { taskId: "task-1", sourceAgentId: "agent-a", targetAgentId: "agent-b", taskType: "VERIFY", riskClass: "HIGH", depth: 1, activeSubtasks: 1, estimatedCost: 2, estimatedDurationMs: 500 };
  assert.equal(authorizeDelegation([rule], base), true);
  assert.equal(authorizeDelegation([rule], { ...base, activeSubtasks: 2 }), false);
  assert.equal(authorizeDelegation([rule], { ...base, estimatedCost: 3 }), false);
  assert.equal(authorizeDelegation([rule], { ...base, estimatedDurationMs: 501 }), false);
  assert.equal(authorizeDelegation([rule], { ...base, sourceAgentId: "agent-b", targetAgentId: "agent-b" }), false);
});

test("typed delegate enforces context and evidence contract", () => {
  const handoff = {
    handoffId: "delegate-h1", missionId: "mission-1", sessionId: "session-1", taskId: "task-1", parentTaskId: null,
    assignmentId: "as-1", sourceAgentId: "agent-a", targetAgentId: "agent-c", taskType: "VERIFY", riskClass: "HIGH",
    reason: "verify", objective: "produce evidence", inputRefs: ["candidate:c1"], requiredCapabilities: ["falsification"],
    expectedOutput: "COUNTEREXAMPLE", verificationCriteria: ["exact SHA"], readScope: "tests/**", writeScope: "reports/**",
    startingSha: task.startingSha, currentSha: task.currentSha, deadlineAtMs: null, budget: { cost: 2, durationMs: 500 },
    evidenceRequirements: ["exact SHA"], returnContract: "return evidence refs",
  };
  const rule = { sourceAgentId: "agent-a", targetAgentId: "agent-c", taskTypes: ["VERIFY"], riskClasses: ["HIGH"], maxDepth: 1, maxActiveSubtasks: 1, maxCost: 2, maxDurationMs: 500 };
  const request = { taskId: "task-1", sourceAgentId: "agent-a", targetAgentId: "agent-c", taskType: "VERIFY", riskClass: "HIGH", depth: 1, activeSubtasks: 1, estimatedCost: 2, estimatedDurationMs: 500 };
  assert.equal(delegateHandoff([rule], request, handoff).handoffId, "delegate-h1");
  assert.throws(() => delegateHandoff([], request, handoff), /DELEGATION_REJECTED/);
  assert.throws(() => delegateHandoff([rule], { ...request, depth: 2 }, handoff), /DELEGATION_REJECTED/);
  assert.throws(() => delegateHandoff([rule], { ...request, estimatedCost: 3 }, handoff), /DELEGATION_REJECTED/);
});

test("zero duration delegation request is rejected fail-closed", () => {
  const rule = {
    sourceAgentId: "agent-a",
    targetAgentId: "agent-b",
    taskTypes: ["VERIFY"],
    riskClasses: ["HIGH"],
    maxDepth: 1,
    maxActiveSubtasks: 1,
    maxCost: 2,
    maxDurationMs: 500,
  };
  const request = {
    taskId: "task-1",
    sourceAgentId: "agent-a",
    targetAgentId: "agent-b",
    taskType: "VERIFY",
    riskClass: "HIGH",
    depth: 1,
    activeSubtasks: 1,
    estimatedCost: 1,
    estimatedDurationMs: 0,
  };
  assert.equal(authorizeDelegation([rule], request), false);
});

test("subtask identity and incomplete handoff are fail-closed", () => {
  assert.throws(() => spawnSubtask("task-1", "task-1", {
    objective: "bad", contextRefs: ["candidate:c1"], requiredCapabilities: ["falsification"], expectedOutput: "COUNTEREXAMPLE",
  }), /INVALID_SUBTASK_SPEC/);
  const base = {
    handoffId: "h2", missionId: "mission-1", sessionId: "session-1", taskId: "task-1", parentTaskId: null, assignmentId: "as-1",
    sourceAgentId: "agent-a", targetAgentId: "agent-c", taskType: "VERIFY", riskClass: "HIGH", reason: "verify",
    objective: "produce evidence", inputRefs: ["candidate:c1"], requiredCapabilities: ["falsification"], expectedOutput: "COUNTEREXAMPLE",
    verificationCriteria: ["exact SHA"], readScope: "tests/**", writeScope: "reports/**", startingSha: task.startingSha, currentSha: task.currentSha,
    deadlineAtMs: null, budget: { cost: 1, durationMs: 500 }, evidenceRequirements: ["exact SHA"], returnContract: "return evidence refs",
  };
  assert.throws(() => validateTypedHandoff({ ...base, verificationCriteria: [] }), /HANDOFF_VERIFICATION_REQUIRED/);
});


test("canonical CELL assignment requires a complete solver/opponent opposition envelope", () => {
  const team = {
    assignmentId: "cell-team-1",
    solverAgentId: "solver",
    backupSolverAgentId: "solver-backup",
    opponentAgentId: "opponent",
    backupOpponentAgentId: "opponent-backup",
    verifierAgentId: "verifier",
    escalationTargetAgentId: "escalation",
    startingSha: task.startingSha,
    currentSha: task.currentSha,
  };

  const assignment = createCanonicalCellAssignment({
    taskId: "task-1",
    missionId: "mission-1",
    riskClass: "HIGH",
    team,
    oppositionPlan: {
      attackSurface: ["acceptance boundary"],
      falsificationQuestions: ["what evidence would disprove this result?"],
      expectedCounterexamples: ["invalid input"],
      evidenceThatWouldDisproveSuccess: ["reproducible failing case"],
      independenceRequirement: "distinct solver/opponent context",
      opponentRecoveryPlan: ["activate backup opponent and re-establish independent start"],
      escalationPolicy: ["escalate on unresolved material dispute"],
    },
    falsificationPolicy: {
      required: true,
      minimumChallengeDepth: "at least one independent challenge cycle",
      counterexampleRequirement: "record a counterexample or explicit no-counterexample result",
    },
    verificationPolicy: {
      verifierRequirement: "independent verifier",
      evidenceRequirement: "reproducible exact-SHA evidence",
      exactShaBinding: true,
    },
    independencePolicy: {
      minimumIndependence: "distinct role and context boundary",
      privateSolverContextExclusion: true,
      preResultOpponentStartRequired: true,
    },
  });

  assert.equal(assignment.solverId, "solver");
  assert.equal(assignment.opponentId, "opponent");
  assert.equal(assignment.backupSolverId, "solver-backup");
  assert.equal(assignment.backupOpponentId, "opponent-backup");
  assert.doesNotThrow(() => validateCanonicalCellAssignment(assignment));
});

test("canonical CELL admission rejects solver/opponent identity collision and incomplete opposition", () => {
  const base = {
    taskId: "task-1",
    missionId: "mission-1",
    solverId: "solver",
    opponentId: "opponent",
    backupSolverId: "solver-backup",
    backupOpponentId: "opponent-backup",
    riskClass: "HIGH",
    oppositionPlan: {
      attackSurface: ["surface"],
      falsificationQuestions: ["question"],
      expectedCounterexamples: ["counterexample"],
      evidenceThatWouldDisproveSuccess: ["evidence"],
      independenceRequirement: "independent",
      opponentRecoveryPlan: ["backup"],
      escalationPolicy: ["escalate"],
    },
    falsificationPolicy: {
      required: true,
      minimumChallengeDepth: "depth",
      counterexampleRequirement: "required",
    },
    verificationPolicy: {
      verifierRequirement: "verifier",
      evidenceRequirement: "evidence",
      exactShaBinding: true,
    },
    independencePolicy: {
      minimumIndependence: "independent",
      privateSolverContextExclusion: true,
      preResultOpponentStartRequired: true,
    },
  } as const;

  assert.throws(
    () => validateCanonicalCellAssignment({ ...base, opponentId: "solver" }),
    /CELL_ASSIGNMENT_ROLE_COLLISION/,
  );
  assert.throws(
    () =>
      validateCanonicalCellAssignment({
        ...base,
        oppositionPlan: { ...base.oppositionPlan, attackSurface: [] },
      }),
    /OPPOSITION_ATTACK_SURFACE_REQUIRED/,
  );
  assert.throws(
    () =>
      validateCanonicalCellAssignment({
        ...base,
        independencePolicy: { ...base.independencePolicy, preResultOpponentStartRequired: false },
      }),
    /OPPONENT_INDEPENDENT_START_REQUIRED/,
  );
});
