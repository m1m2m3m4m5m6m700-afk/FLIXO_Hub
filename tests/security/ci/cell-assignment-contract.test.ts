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
  validateTypedHandoff,
  type AssignmentAgentProfile,
  type AssignmentRequirements,
} from "../../packages/contracts/src/cell-assignment.ts";

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
    capabilities: ["verification"],
    outputTypes: ["report"],
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
    capabilities: ["falsification"],
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
    capabilities: ["implementation"],
    outputTypes: ["patch"],
    riskClasses: ["LOW"],
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

test("high-risk assignment requires an independent verifier", () => {
  const ranked = rankAgentsForTask(agents, task);
  const quartet = selectAssignmentQuartet(
    "as-1",
    ranked,
    ["agent-c"],
    ["agent-d"],
    true,
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
    sourceAgentId: "agent-a",
    targetAgentId: "agent-c",
    reason: "independent verification",
    objective: "produce counterexample",
    inputRefs: ["candidate:c1"],
    requiredCapabilities: ["falsification"],
    expectedOutput: "counterexample",
    verificationCriteria: ["reproducible evidence"],
    readScope: "tests/**",
    writeScope: "reports/**",
    currentSha: "sha-a",
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
  });
  assert.equal(team.solverAgentId, "agent-a");
  assert.notEqual(team.opponentAgentId, team.solverAgentId);
  assert.ok(team.verifierAgentId !== team.solverAgentId);
});