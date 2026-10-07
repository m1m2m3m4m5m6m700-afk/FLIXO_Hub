export const CALL_LEDGER_VERSION = "1.0.0" as const;

export type EvidenceKind = "TEST_LOG" | "CI_RUN" | "COUNTEREXAMPLE" | "BENCHMARK" | "SECURITY_SCAN" | "MANUAL_INSPECTION";

export type EvidenceRecord = Readonly<{
  evidenceId: string;
  taskId: string;
  agentId: string;
  kind: EvidenceKind;
  sourceSha: string;
  logRef: string;
  reproducerRef: string | null;
  accepted: boolean;
  dispositionRef: string;
}>;

export type MemoryEntry = Readonly<{
  id: string;
  sha: string;
  sourceAgent: string;
  evidenceRefs: readonly string[];
  confidence: number;
  ttlMs: number | null;
  supersedes: string | null;
  invalidatedBy: readonly string[];
  domain: string;
}>;

export type ReputationOutcome = Readonly<{
  agentId: string;
  taskId: string;
  domain: string;
  delta: number;
  evidenceRef: string;
  dispositionRef: string;
  sourceSha: string;
  policyVersion: string;
}>;

export function validateEvidence(record: EvidenceRecord): void {
  if (!record.evidenceId || !record.taskId || !record.agentId || !record.logRef || !record.dispositionRef) {
    throw new Error("EVIDENCE_SCHEMA_INVALID");
  }
  if (!/^[0-9a-f]{40}$/iu.test(record.sourceSha)) throw new Error("EVIDENCE_SHA_INVALID");
  if (!record.accepted) throw new Error("EVIDENCE_NOT_ACCEPTED");
}

export function validateMemoryEntry(entry: MemoryEntry): void {
  if (!entry.id || !entry.sourceAgent || !entry.domain || entry.evidenceRefs.length === 0) {
    throw new Error("MEMORY_REQUIRES_EVIDENCE");
  }
  if (!/^[0-9a-f]{40}$/iu.test(entry.sha)) throw new Error("MEMORY_SHA_INVALID");
  if (!Number.isFinite(entry.confidence) || entry.confidence < 0 || entry.confidence > 1) {
    throw new Error("MEMORY_CONFIDENCE_INVALID");
  }
  if (entry.ttlMs !== null && (!Number.isFinite(entry.ttlMs) || entry.ttlMs <= 0)) {
    throw new Error("MEMORY_TTL_INVALID");
  }
}

export function validateReputationOutcome(outcome: ReputationOutcome): void {
  validateEvidence({
    evidenceId: outcome.evidenceRef,
    taskId: outcome.taskId,
    agentId: outcome.agentId,
    kind: "MANUAL_INSPECTION",
    sourceSha: outcome.sourceSha,
    logRef: outcome.evidenceRef,
    reproducerRef: null,
    accepted: true,
    dispositionRef: outcome.dispositionRef,
  });
  if (!outcome.policyVersion) throw new Error("REPUTATION_POLICY_REQUIRED");
  if (!Number.isFinite(outcome.delta)) throw new Error("REPUTATION_DELTA_INVALID");
}
