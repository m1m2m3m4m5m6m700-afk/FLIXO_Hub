export const CALL_OBJECTIVE_REGISTRY_VERSION = "1.0.0" as const;

export type ObjectiveDisposition = "DUPLICATE" | "RELATED" | "INDEPENDENT" | "CONFLICTING";

export type ObjectiveRecord = Readonly<{
  objectiveId: string;
  owner: string;
  normalizedHash: string;
  objective: string;
  acceptanceCriteria: readonly string[];
  status: "QUEUED" | "ACTIVE" | "COMPLETED" | "REJECTED";
  createdAtMs: number;
}>;

export type ObjectiveComparison = Readonly<{
  candidateId: string;
  disposition: ObjectiveDisposition;
  similarity: number;
  comparedWith: readonly string[];
}>;

export function normalizeObjective(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/gu, " ");
}

export async function objectiveHash(value: string): Promise<string> {
  const normalized = normalizeObjective(value);
  if (!normalized) throw new Error("OBJECTIVE_REQUIRED");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function classifyObjectiveComparison(
  similarity: number,
  exactIdentity: boolean,
  conflict: boolean,
): ObjectiveDisposition {
  if (!Number.isFinite(similarity) || similarity < 0 || similarity > 1) throw new Error("OBJECTIVE_SIMILARITY_INVALID");
  if (exactIdentity) return "DUPLICATE";
  if (conflict) return "CONFLICTING";
  if (similarity >= 0.85) return "RELATED";
  return "INDEPENDENT";
}
