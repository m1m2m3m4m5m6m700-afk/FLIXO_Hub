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

export {
  CELL_CONTRACT_VERSION,
  TASK_STATES as CELL_TASK_STATES,
  type TaskState as CellTaskState,
  AGENT_STATES,
  type AgentState,
  CANDIDATE_STATES,
  type CandidateState,
  type CellEntity,
  canTransition,
  assertTransition,
  type Lease,
  isLeaseLive,
  assertLeaseOwner,
  type RetryDecision,
  decideRetry,
  type EvidenceRecord,
  isEvidenceCurrent,
  classifyEvidence as classifyCellEvidence,
  type PromotionGate,
  canPromote,
  type MemoryRecord,
  isMemoryActionable,
  type WakeDecision,
  guardianDecision,
  type FrontierInput,
  scoreFrontier,
} from "./cell-control-plane";
export * from "./cell-runtime";
export * from "./cell-assignment";
export * from "./cell-hard-control";
export * from "./agent-learning";
export * from "./cell-lifecycle";
export * from "./cell-liveness";

export {
  POLICY_KERNEL_VERSION,
  POLICY_KERNEL_RULES,
  POLICY_KERNEL_CANONICAL_JSON,
  POLICY_KERNEL_HASH,
  POLICY_AUTHORITY_MODEL,
  authorizePolicyAction,
  assertPolicyActionAuthorized,
  computeSha256Hex,
  computePolicyKernelHash,
  verifyPolicyKernelIntegrity,
  CANDIDATE_INTERFACE_VERSION,
  CANDIDATE_INTERFACE_SPEC,
  CANDIDATE_INTERFACE_CANONICAL_JSON,
  CANDIDATE_INTERFACE_DIGEST,
  validateMissionAdmission,
  validateCandidateAdmission,
  assertCandidateAdmission,
  DOWNSTREAM_GATES,
  invalidateAfterCandidateShaChange,
  validateEvidenceProvenance,
  classifyEvidence as classifyTruthEvidence,
  assertFreshEvidence,
  computeEvidenceDigest,
  proveGateATwoSha,
  MVP_TRUTH_CONTRACT_VERSION,
  MVP_TRUTH_FIELDS,
  validateMvpTruthRecord,
  assertMvpTruthSet,
} from "./truth-contracts";

export type {
  PolicyActor,
  PolicyOperation,
  MissionAdmissionManifest,
  CandidateAdmissionManifest,
  CandidateAdmissionResult,
  CandidateShaInvalidation,
  EvidenceProvenanceRecord,
  EvidenceFreshnessBinding,
  GateAResult,
  MvpTruthRecord,
} from "./truth-contracts";
