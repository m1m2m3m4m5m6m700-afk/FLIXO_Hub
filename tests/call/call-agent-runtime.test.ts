import assert from "node:assert/strict";
import test from "node:test";
import { CellAgentRuntime, type AgentExecutionRequest, type AgentRuntimeAdapter } from "../../packages/contracts/src/call-agent-runtime";
import { type CellWorkspace } from "../../packages/contracts/src/call-workspace";

const SHA = "0123456789abcdef0123456789abcdef01234567";

function workspace(role: CellWorkspace["role"], agentId: string): CellWorkspace {
  return Object.freeze({
    workspaceId: `ws-${agentId}`,
    agentId,
    role,
    baseSha: SHA,
    filesystemRoot: `/work/${agentId}/`,
    network: "DENY",
    pushTargets: ["execution"],
    capabilities: ["build"],
  });
}

test("agent runtime fails closed without a configured executor", async () => {
  const runtime = new CellAgentRuntime();
  const request: AgentExecutionRequest = {
    taskId: "task-1",
    assignmentId: "assignment-1",
    agentId: "builder-1",
    role: "SOLVER",
    baseSha: SHA,
    workspace: workspace("SOLVER", "builder-1"),
    instructions: ["implement the assigned change"],
    inputRefs: ["admission-1"],
  };
  await assert.rejects(() => runtime.execute(request), /AGENT_RUNTIME_UNAVAILABLE/);
});

test("agent runtime preserves assignment lineage and exact starting SHA", async () => {
  const adapter: AgentRuntimeAdapter = {
    runtimeId: "test-runtime",
    async execute(request) {
      return {
        runId: "run-1",
        taskId: request.taskId,
        assignmentId: request.assignmentId,
        agentId: request.agentId,
        role: request.role,
        startingSha: request.baseSha,
        endingSha: SHA,
        status: "COMPLETED",
        artifactRefs: ["artifact-1"],
        evidenceRefs: ["evidence-1"],
        summary: "completed",
      };
    },
  };
  const runtime = new CellAgentRuntime(adapter);
  const result = await runtime.execute({
    taskId: "task-1",
    assignmentId: "assignment-1",
    agentId: "builder-1",
    role: "SOLVER",
    baseSha: SHA,
    workspace: workspace("SOLVER", "builder-1"),
    instructions: ["implement"],
    inputRefs: ["admission-1"],
  });
  assert.equal(result.startingSha, SHA);
  assert.equal(result.assignmentId, "assignment-1");
});

test("agent runtime rejects workspace identity and SHA drift", async () => {
  const runtime = new CellAgentRuntime({
    runtimeId: "test-runtime",
    async execute(request) {
      return {
        runId: "run-1", taskId: request.taskId, assignmentId: request.assignmentId,
        agentId: request.agentId, role: request.role, startingSha: request.baseSha,
        endingSha: SHA, status: "COMPLETED", artifactRefs: [], evidenceRefs: [], summary: "ok",
      };
    },
  });
  await assert.rejects(() => runtime.execute({
    taskId: "task-1", assignmentId: "assignment-1", agentId: "builder-1", role: "SOLVER",
    baseSha: "fedcba9876543210fedcba9876543210fedcba98",
    workspace: workspace("SOLVER", "builder-1"),
    instructions: ["implement"], inputRefs: ["admission-1"],
  }), /AGENT_WORKSPACE_SHA_MISMATCH/);
});

test("agent runtime forbids main push", () => {
  const runtime = new CellAgentRuntime();
  assert.throws(() => runtime.assertPushAllowed(workspace("SOLVER", "builder-1"), "main"), /AGENT_PUSH_NOT_ALLOWED/);
});
