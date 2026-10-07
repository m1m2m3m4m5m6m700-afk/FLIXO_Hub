export const CELL_XP_LEDGER_VERSION = "1.0.0" as const;

export type CellXpOutcome = "SUCCESS" | "COUNTEREXAMPLE" | "USEFUL_EVIDENCE" | "FALSE_CLAIM" | "FAILED_MISSION";

export type CellXpEntry = Readonly<{
  entryId: string;
  agentId: string;
  taskId: string;
  domain: string;
  delta: number;
  outcome: CellXpOutcome;
  evidenceRef: string;
  dispositionRef: string;
  sourceSha: string;
  policyVersion: string;
  policyHash: string;
  createdAtMs: number;
}>;

export class CellXpLedger {
  private readonly entries: CellXpEntry[] = [];

  append(entry: CellXpEntry): CellXpEntry {
    const required = [entry.entryId, entry.agentId, entry.taskId, entry.domain, entry.evidenceRef, entry.dispositionRef, entry.policyVersion];
    if (required.some((value) => !value.trim())) throw new Error("CELL_XP_REQUIRED");
    if (!Number.isFinite(entry.delta) || entry.delta < -100 || entry.delta > 100) throw new Error("CELL_XP_DELTA_INVALID");
    if (!/^[0-9a-f]{40}$/iu.test(entry.sourceSha)) throw new Error("CELL_XP_SHA_INVALID");
    if (!/^[0-9a-f]{64}$/iu.test(entry.policyHash)) throw new Error("CELL_XP_POLICY_HASH_INVALID");
    if (this.entries.some((existing) => existing.entryId === entry.entryId)) throw new Error("CELL_XP_ID_DUPLICATE");
    const stored = Object.freeze({ ...entry });
    this.entries.push(stored);
    return stored;
  }

  snapshot(): readonly CellXpEntry[] {
    return Object.freeze([...this.entries]);
  }
}
