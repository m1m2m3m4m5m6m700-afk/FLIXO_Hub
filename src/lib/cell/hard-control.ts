import {
  CELL_AUTHORITY_RANK,
  CELL_POLICY_VERSION,
  type CellAdmissionDecision,
  type CellAdmissionRequest,
  type CellAuthority,
  type CellExecutionEnvelope,
} from "./types.ts";

const SHA = /^[0-9a-f]{40}$/;
const ID = /^[A-Za-z0-9._:-]{3,128}$/;

function deny(code: Exclude<CellAdmissionDecision, { allowed: true }>["code"], reason: string): CellAdmissionDecision {
  return Object.freeze({ allowed: false, code, reason, policyVersion: CELL_POLICY_VERSION });
}

function validAuthority(value: unknown): value is CellAuthority {
  return typeof value === "string" && value in CELL_AUTHORITY_RANK;
}

export function validateCellEnvelope(envelope: CellExecutionEnvelope): CellAdmissionDecision {
  if (envelope.policyVersion !== CELL_POLICY_VERSION) return deny("UNKNOWN_POLICY", "CELL policy version is not admitted.");
  if (!ID.test(envelope.executionId) || !ID.test(envelope.taskId) || !ID.test(envelope.agentId)) {
    return deny("AGENT_IDENTITY_INVALID", "Execution, task, and agent identities must be canonical.");
  }
  if (!SHA.test(envelope.baseSha) || !SHA.test(envelope.currentSha)) {
    return deny("INVALID_ENVELOPE", "Base and current repository state must be exact lowercase SHA-1 values.");
  }
  if (!validAuthority(envelope.authority)) return deny("INVALID_ENVELOPE", "Authority is invalid.");
  if (envelope.delegatedAuthority && !validAuthority(envelope.delegatedAuthority)) {
    return deny("INVALID_ENVELOPE", "Delegated authority is invalid.");
  }
  if (envelope.delegatedAuthority &&
      CELL_AUTHORITY_RANK[envelope.delegatedAuthority] > CELL_AUTHORITY_RANK[envelope.authority]) {
    return deny("AUTHORITY_ESCALATION", "Delegated authority cannot exceed parent authority.");
  }
  if (!envelope.objectiveDigest || !envelope.acceptanceDigest) {
    return deny("INVALID_ENVELOPE", "Objective and acceptance digests are mandatory.");
  }
  if (!Number.isInteger(envelope.budget.maxAttempts) || envelope.budget.maxAttempts < 1 || envelope.budget.maxAttempts > 3) {
    return deny("ATTEMPT_BUDGET_INVALID", "Execution attempts must be bounded to 1..3.");
  }
  if (!Number.isInteger(envelope.budget.maxDelegationDepth) || envelope.budget.maxDelegationDepth < 0 || envelope.budget.maxDelegationDepth > 8) {
    return deny("INVALID_ENVELOPE", "Delegation depth must be bounded to 0..8.");
  }
  if (!Number.isInteger(envelope.budget.maxChildren) || envelope.budget.maxChildren < 0 || envelope.budget.maxChildren > 32) {
    return deny("INVALID_ENVELOPE", "Child-agent budget must be bounded to 0..32.");
  }
  if (!Number.isInteger(envelope.budget.timeoutMs) || envelope.budget.timeoutMs < 1 || envelope.budget.timeoutMs > 10 * 60 * 1000) {
    return deny("INVALID_ENVELOPE", "Execution timeout is outside the CELL safety bound.");
  }
  return Object.freeze({ allowed: true, policyVersion: CELL_POLICY_VERSION });
}

export function admitCellAction(
  envelope: CellExecutionEnvelope,
  request: CellAdmissionRequest,
): CellAdmissionDecision {
  const envelopeDecision = validateCellEnvelope(envelope);
  if (!envelopeDecision.allowed) return envelopeDecision;

  if (request.repository !== envelope.repository) {
    return deny("REPOSITORY_MISMATCH", "Repository does not match the admitted envelope.");
  }
  if (request.currentSha !== envelope.currentSha) {
    return deny("SHA_DRIFT", "Repository SHA changed outside the admitted execution state.");
  }
  if (request.objectiveDigest !== envelope.objectiveDigest) {
    return deny("OBJECTIVE_DRIFT", "Objective digest changed after admission.");
  }
  if (request.acceptanceDigest !== envelope.acceptanceDigest) {
    return deny("ACCEPTANCE_DRIFT", "Acceptance criteria changed after admission.");
  }
  if (!envelope.capabilities.includes(request.capability)) {
    return deny("CAPABILITY_NOT_GRANTED", "Requested capability is not granted by the envelope.");
  }
  if (!envelope.scopes.includes(request.scope)) {
    return deny("SCOPE_NOT_GRANTED", "Requested scope is not granted by the envelope.");
  }
  if (envelope.forbiddenActions.includes(request.action)) {
    return deny("FORBIDDEN_ACTION", "Requested action is explicitly forbidden.");
  }
  if (request.action === "CELL_POLICY_MUTATION" && envelope.authority !== "ROOT") {
    return deny("CELL_SELF_MODIFICATION", "Only ROOT authority may mutate CELL policy.");
  }
  const depth = request.delegationDepth ?? 0;
  if (depth > envelope.budget.maxDelegationDepth) {
    return deny("DELEGATION_DEPTH_EXCEEDED", "Delegation depth exceeds the envelope budget.");
  }
  if (request.childAuthority &&
      CELL_AUTHORITY_RANK[request.childAuthority] > CELL_AUTHORITY_RANK[envelope.authority]) {
    return deny("AUTHORITY_ESCALATION", "Child authority cannot exceed delegating authority.");
  }
  if (envelope.evidence.requireEvidenceDigest && request.evidenceRequested !== true) {
    return deny("EVIDENCE_REQUIRED", "This execution requires evidence binding.");
  }
  return Object.freeze({ allowed: true, policyVersion: CELL_POLICY_VERSION });
}

export function assertCellAction(
  envelope: CellExecutionEnvelope,
  request: CellAdmissionRequest,
): void {
  const decision = admitCellAction(envelope, request);
  if (!decision.allowed) throw new Error(`CELL_DENIED:${decision.code}: ${decision.reason}`);
}
