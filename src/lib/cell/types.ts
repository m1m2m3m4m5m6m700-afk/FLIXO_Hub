export type CellDecision = "ALLOW" | "DENY";
export type CellDenialCode =
  | "UNKNOWN_CAPABILITY"
  | "CAPABILITY_NOT_EXECUTABLE"
  | "CAPABILITY_NOT_READY"
  | "EXECUTOR_BINDING_MISMATCH"
  | "OUTPUT_CONTRACT_BINDING_MISMATCH"
  | "NON_LOCAL_EXECUTION"
  | "NETWORK_REQUIRED"
  | "INVALID_REQUEST_ID"
  | "INVALID_TASK_ID"
  | "INVALID_SCOPE"
  | "BUDGET_EXCEEDED"
  | "CHAIN_LIMIT_EXCEEDED"
  | "ABORTED";

export type CellAuthority = Readonly<{
  agentId: string;
  role: "system" | "assistant" | "tool" | "user";
  capabilities: readonly string[];
  scopes: readonly string[];
  parentAgentId?: string;
}>;

export type CellAdmissionRequest = Readonly<{
  requestId: string;
  taskId: string;
  capabilityId: string;
  scope: string;
  authority?: CellAuthority;
  maxAttempts: number;
  chainDepth?: number;
  signal?: AbortSignal;
}>;

export type CellAdmissionDecision =
  | Readonly<{ decision: "ALLOW"; capabilityId: string; policyFingerprint: string }>
  | Readonly<{ decision: "DENY"; code: CellDenialCode; reason: string; capabilityId: string }>;

export type CellExecutionEnvelope = Readonly<{
  requestId: string;
  taskId: string;
  capabilityId: string;
  scope: string;
  policyFingerprint: string;
  admittedAt: string;
}>;

export type CellAuditEvent = Readonly<{
  type: "ADMISSION_ALLOWED" | "ADMISSION_DENIED" | "EXECUTION_STARTED" | "EXECUTION_VERIFIED" | "EXECUTION_FAILED";
  requestId: string;
  taskId: string;
  capabilityId: string;
  at: string;
  detail?: string;
}>;
