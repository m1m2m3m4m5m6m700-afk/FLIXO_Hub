export const CELL_MEMORY_CONTRACT_VERSION = "1.0.0" as const;

export type CellMemoryRecord = Readonly<{
  memoryId: string;
  taskId: string;
  sourceSha: string;
  evidenceIds: readonly string[];
  independentConfirmations: number;
  regressionPassed: boolean;
  claim: string;
  confidence: number;
  policyVersion: string;
  policyHash: string;
  createdAtMs: number;
}>;

export class CellMemoryLedger {
  private readonly records: CellMemoryRecord[] = [];

  append(record: CellMemoryRecord): CellMemoryRecord {
    if (!record.memoryId.trim() || !record.taskId.trim() || !record.claim.trim()) throw new Error("CELL_MEMORY_REQUIRED");
    if (!/^[0-9a-f]{40}$/iu.test(record.sourceSha)) throw new Error("CELL_MEMORY_SHA_INVALID");
    if (record.evidenceIds.length === 0 || record.evidenceIds.some((id) => !id.trim())) throw new Error("CELL_MEMORY_EVIDENCE_REQUIRED");
    if (!Number.isInteger(record.independentConfirmations) || record.independentConfirmations < 1) throw new Error("CELL_MEMORY_INDEPENDENCE_REQUIRED");
    if (!record.regressionPassed) throw new Error("CELL_MEMORY_REGRESSION_REQUIRED");
    if (!Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 1) throw new Error("CELL_MEMORY_CONFIDENCE_INVALID");
    if (!/^[0-9a-f]{64}$/iu.test(record.policyHash)) throw new Error("CELL_MEMORY_POLICY_HASH_INVALID");
    if (this.records.some((existing) => existing.memoryId === record.memoryId)) throw new Error("CELL_MEMORY_ID_DUPLICATE");
    const stored = Object.freeze({ ...record, evidenceIds: Object.freeze([...record.evidenceIds]) });
    this.records.push(stored);
    return stored;
  }

  snapshot(): readonly CellMemoryRecord[] {
    return Object.freeze([...this.records]);
  }
}
