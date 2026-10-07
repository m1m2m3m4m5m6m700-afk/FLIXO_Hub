export const CELL_POLICY_VERSION = "1.0.0" as const;

export const CELL_AUTHORITY_RANK = {
  SCOUT: 10,
  ANALYST: 20,
  IMPLEMENTER: 30,
  INTEGRATOR: 40,
  CERTIFIER: 50,
  ROOT: 100,
} as const;

export type CellAuthority = keyof typeof CELL_AUTHORITY_RANK;

export type CellBudget = Readonly<{
  maxAttempts: number;
  maxDelegationDepth: number;
  maxChildren: number;
  timeoutMs: number;
  maxFilesChanged?: number;
}>;

export type CellEvidenceRequirements = Readonly<{
  requireExecutionId: boolean;
  requireExactSha: boolean;
  requireVerifier: boolean;
  requireEvidenceDigest: boolean;
}>;

export type CellExecutionEnvelope = Readonly<{
  executionId: string;
  taskId: string;
  agentId: string;
  parentExecutionId?: string;
  repository: string;
  baseSha: string;
  currentSha: string;
  branch: string;
  objectiveDigest: string;
  acceptanceDigest: string;
  policyVersion: typeof CELL_POLICY_VERSION;
  authority: CellAuthority;
  delegatedAuthority?: CellAuthority;
  capabilities: readonly string[];
  scopes: readonly string[];
  forbiddenActions: readonly string[];
  budget: CellBudget;
  evidence: CellEvidenceRequirements;
}>;

export type CellAdmissionRequest = Readonly<{
  action: string;
  capability: string;
  scope: string;
  repository: string;
  currentSha: string;
  objectiveDigest: string;
  acceptanceDigest: string;
  delegationDepth?: number;
  childAuthority?: CellAuthority;
  evidenceRequested?: boolean;
}>;

export type CellDenialCode =
  | "INVALID_ENVELOPE"
  | "UNKNOWN_POLICY"
  | "AGENT_IDENTITY_INVALID"
  | "AUTHORITY_ESCALATION"
  | "CAPABILITY_NOT_GRANTED"
  | "SCOPE_NOT_GRANTED"
  | "FORBIDDEN_ACTION"
  | "REPOSITORY_MISMATCH"
  | "SHA_DRIFT"
  | "OBJECTIVE_DRIFT"
  | "ACCEPTANCE_DRIFT"
  | "DELEGATION_DEPTH_EXCEEDED"
  | "ATTEMPT_BUDGET_INVALID"
  | "EVIDENCE_REQUIRED"
  | "CELL_SELF_MODIFICATION";

export type CellAdmissionDecision =
  | Readonly<{ allowed: true; policyVersion: typeof CELL_POLICY_VERSION }>
  | Readonly<{ allowed: false; code: CellDenialCode; reason: string; policyVersion: typeof CELL_POLICY_VERSION }>;

export type CellExecutionState =
  | "CREATED"
  | "ADMITTED"
  | "RUNNING"
  | "VERIFYING"
  | "EVIDENCE"
  | "ACCEPTED"
  | "CERTIFIED"
  | "PROMOTED"
  | "DENIED"
  | "ABORTED"
  | "FAILED"
  | "QUARANTINED";

export const CELL_TERMINAL_STATES: readonly CellExecutionState[] = [
  "ACCEPTED",
  "CERTIFIED",
  "PROMOTED",
  "DENIED",
  "ABORTED",
  "FAILED",
  "QUARANTINED",
] as const;
