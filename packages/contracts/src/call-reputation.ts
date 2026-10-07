export const CALL_REPUTATION_VERSION = "0.1.0-provisional" as const;

export type ReputationRecord = Readonly<{
  agentId: string;
  domain: string;
  rating: number;
  uncertainty: number;
  sampleCount: number;
  successfulClaims: number;
  validCounterexamples: number;
  usefulEvidence: number;
  falseClaims: number;
  failedExperiments: number;
}>;

export type ReputationOutcome = Readonly<{
  agentId: string;
  taskId: string;
  domain: string;
  delta: number;
  evidenceId: string;
  dispositionId: string;
  sourceSha: string;
  policyVersion: string;
}>;

export function validateReputationOutcome(outcome: ReputationOutcome): void {
  if (!outcome.agentId || !outcome.taskId || !outcome.domain || !outcome.evidenceId || !outcome.dispositionId || !outcome.policyVersion) {
    throw new Error("REPUTATION_EVIDENCE_REQUIRED");
  }
  if (!/^[0-9a-f]{40}$/iu.test(outcome.sourceSha)) throw new Error("REPUTATION_SHA_INVALID");
  if (!Number.isFinite(outcome.delta)) throw new Error("REPUTATION_DELTA_INVALID");
}

export function assertNoAuthorityByReputation(): never {
  throw new Error("REPUTATION_IS_NOT_AUTHORITY");
}
