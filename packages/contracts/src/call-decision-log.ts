export const CALL_DECISION_LOG_VERSION = "1.0.0" as const;

export type CallDecisionLogEntry = Readonly<{
  decisionId: string;
  ts: number;
  actorId: string;
  role: string;
  gate: string;
  policyRuleId: string;
  policyHash: string;
  inputSha: string;
  outputSha: string;
  rationaleRef: string;
  reversible: boolean;
}>;

export function validateDecisionLogEntry(entry: CallDecisionLogEntry): void {
  for (const value of [entry.decisionId, entry.actorId, entry.role, entry.gate, entry.policyRuleId, entry.policyHash, entry.rationaleRef]) {
    if (!value.trim()) throw new Error("DECISION_LOG_REQUIRED");
  }
  for (const value of [entry.inputSha, entry.outputSha]) {
    if (!/^[0-9a-f]{40}$/iu.test(value)) throw new Error("DECISION_LOG_SHA_INVALID");
  }
  if (!Number.isFinite(entry.ts)) throw new Error("DECISION_LOG_TIMESTAMP_INVALID");
}
