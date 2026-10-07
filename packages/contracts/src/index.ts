export const TASK_STATES = [
  "IDLE",
  "NEEDS_INPUT",
  "PLANNED",
  "AWAITING_CONFIRMATION",
  "EXECUTING",
  "VERIFYING",
  "RECOVERING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type TaskState = (typeof TASK_STATES)[number];

export type AgentRole = "system" | "user" | "assistant" | "tool";

export type AgentMessage = Readonly<{
  id: string;
  role: AgentRole;
  content: string;
  createdAt: string;
}>;

export type ToolCall = Readonly<{
  callId: string;
  toolId: string;
  parameters: Readonly<Record<string, unknown>>;
}>;

export type ToolResultStatus = "success" | "error";

export type ToolResult = Readonly<{
  callId: string;
  toolId: string;
  status: ToolResultStatus;
  data?: Readonly<Record<string, unknown>>;
  error?: Readonly<{
    code: string;
    message: string;
    retryable: boolean;
  }>;
  durationMs?: number;
}>;

export type ExecutionRequest = Readonly<{
  requestId: string;
  taskId: string;
  traceId: string;
  toolCall: ToolCall;
}>;

export type ExecutionResult = Readonly<{
  requestId: string;
  taskId: string;
  traceId: string;
  result: ToolResult;
}>;

export type AgentResponse = Readonly<{
  messageId: string;
  content: string;
  toolCalls: readonly ToolCall[];
  toolResults: readonly ToolResult[];
  requiresUserConfirmation: boolean;
}>;

export type ContractFailureCode =
  | "INVALID_INPUT"
  | "UNKNOWN_TOOL"
  | "CAPABILITY_NOT_EXECUTABLE"
  | "EXECUTOR_UNAVAILABLE"
  | "VERIFIER_UNAVAILABLE"
  | "OUTPUT_CONTRACT_MISSING"
  | "EXECUTION_REJECTED"
  | "EXECUTION_FAILED";

export const CONTRACT_VERSION = "1.0.0" as const;

export function createContractFailure(
  code: ContractFailureCode,
  message: string,
  retryable = false,
): NonNullable<ToolResult["error"]> {
  return Object.freeze({ code, message, retryable });
}

export * from "./cell-control-plane";
export * from "./cell-runtime";
export * from "./cell-assignment";
export * from "./cell-hard-control";
export * from "./agent-learning";
export * from "./cell-lifecycle";

export * from "./call-context";
export * from "./call-policy-kernel";
export * from "./call-mission-control";
export * from "./call-ledgers";
export * from "./call-objective-registry";
export * from "./call-candidate-bundle";

export * from "./call-opposition";
export * from "./call-red-team";
export * from "./call-decision-log";
export * from "./call-rollback";
export * from "./call-reputation";

export * from "./call-policy";

export * from "./call-gate-a";

export * from "./call-self-development";

export * from "./call-workspace";
export * from "./call-agent-runtime";

export * from "./call-model-catalog";
export * from "./call-model-router";
export * from "./call-collaboration";
export * from "./call-ranks";
