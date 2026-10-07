import {
  assertWorkspaceIsolation,
  canWorkspacePush,
  type CellWorkspace,
} from "./call-workspace";

export const CALL_AGENT_RUNTIME_VERSION = "1.0.0" as const;

export type AgentRole = "SOLVER" | "OPPONENT" | "RED_TEAM" | "VERIFIER";

export type AgentExecutionRequest = Readonly<{
  taskId: string;
  assignmentId: string;
  agentId: string;
  role: AgentRole;
  baseSha: string;
  workspace: CellWorkspace;
  instructions: readonly string[];
  inputRefs: readonly string[];
}>;

export type AgentExecutionResult = Readonly<{
  runId: string;
  taskId: string;
  assignmentId: string;
  agentId: string;
  role: AgentRole;
  startingSha: string;
  endingSha: string;
  status: "COMPLETED" | "FAILED" | "BLOCKED";
  artifactRefs: readonly string[];
  evidenceRefs: readonly string[];
  summary: string;
}>;

export type AgentRuntimeAdapter = Readonly<{
  runtimeId: string;
  execute: (request: AgentExecutionRequest) => Promise<AgentExecutionResult>;
}>;

const SHA = /^[0-9a-f]{40}$/iu;

function validateRequest(request: AgentExecutionRequest): void {
  if (!request.taskId.trim()) throw new Error("AGENT_TASK_REQUIRED");
  if (!request.assignmentId.trim()) throw new Error("AGENT_ASSIGNMENT_REQUIRED");
  if (!request.agentId.trim()) throw new Error("AGENT_ID_REQUIRED");
  if (!SHA.test(request.baseSha)) throw new Error("AGENT_BASE_SHA_INVALID");
  if (request.workspace.agentId !== request.agentId) throw new Error("AGENT_WORKSPACE_IDENTITY_MISMATCH");
  if (request.workspace.baseSha !== request.baseSha) throw new Error("AGENT_WORKSPACE_SHA_MISMATCH");
  if (request.workspace.role !== request.role) throw new Error("AGENT_WORKSPACE_ROLE_MISMATCH");
  if (request.instructions.length === 0) throw new Error("AGENT_INSTRUCTIONS_REQUIRED");
  if (request.inputRefs.some((ref) => !ref.trim())) throw new Error("AGENT_INPUT_REF_INVALID");
}

export class CellAgentRuntime {
  constructor(private readonly adapter: AgentRuntimeAdapter | null = null) {}

  get runtimeId(): string | null {
    return this.adapter?.runtimeId ?? null;
  }

  async execute(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    validateRequest(request);
    if (!this.adapter) throw new Error("AGENT_RUNTIME_UNAVAILABLE");

    if (request.role !== "SOLVER") {
      const peer: CellWorkspace = Object.freeze({
        ...request.workspace,
        workspaceId: `${request.workspace.workspaceId}:peer`,
        agentId: `${request.workspace.agentId}:peer`,
      });
      assertWorkspaceIsolation(request.workspace, peer, `${request.workspace.filesystemRoot}/peer`);
    }

    const result = await this.adapter.execute(Object.freeze(request));
    if (result.taskId !== request.taskId || result.assignmentId !== request.assignmentId) {
      throw new Error("AGENT_RESULT_LINEAGE_MISMATCH");
    }
    if (result.agentId !== request.agentId || result.role !== request.role) {
      throw new Error("AGENT_RESULT_IDENTITY_MISMATCH");
    }
    if (result.startingSha !== request.baseSha) throw new Error("AGENT_RESULT_START_SHA_MISMATCH");
    if (!SHA.test(result.endingSha)) throw new Error("AGENT_RESULT_END_SHA_INVALID");
    if (result.artifactRefs.some((ref) => !ref.trim()) || result.evidenceRefs.some((ref) => !ref.trim())) {
      throw new Error("AGENT_RESULT_REF_INVALID");
    }
    return Object.freeze({ ...result });
  }

  assertPushAllowed(workspace: CellWorkspace, branch: string): void {
    if (!canWorkspacePush(workspace, branch)) throw new Error("AGENT_PUSH_NOT_ALLOWED");
  }
}
