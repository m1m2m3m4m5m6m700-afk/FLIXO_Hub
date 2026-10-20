export const CALL_CONTEXT_CONTRACT_VERSION = "1.0.0" as const;

export type CanonicalTaskContext = Readonly<{
  missionId: string;
  taskId: string;
  objective: string;
  acceptanceCriteria: readonly string[];
  constraints: readonly string[];
  oppositionPlanHash: string;
  startingSha: string;
}>;

export type AuthorityContextArtifact = Readonly<{
  taskId: string;
  policyVersion: string;
  context: CanonicalTaskContext;
  canonicalJson: string;
  sharedContextHash: string;
  createdAtMs: number;
}>;

const SHA256 = /^[0-9a-f]{64}$/iu;
const GIT_SHA = /^[0-9a-f]{40}$/iu;

function required(value: string, code: string): void {
  if (typeof value !== "string" || value.trim() === "") throw new Error(code);
}

function canonicalValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalValue).join(",") + "]";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return "{" + Object.keys(record).sort().map((key) => JSON.stringify(key) + ":" + canonicalValue(record[key])).join(",") + "}";
  }
  throw new Error("CALL_CONTEXT_UNSUPPORTED_VALUE");
}

export function canonicalizeTaskContext(context: CanonicalTaskContext): string {
  required(context.missionId, "CALL_CONTEXT_MISSION_REQUIRED");
  required(context.taskId, "CALL_CONTEXT_TASK_REQUIRED");
  required(context.objective, "CALL_CONTEXT_OBJECTIVE_REQUIRED");
  required(context.oppositionPlanHash, "CALL_CONTEXT_OPPOSITION_HASH_REQUIRED");
  if (!GIT_SHA.test(context.startingSha)) throw new Error("CALL_CONTEXT_STARTING_SHA_INVALID");
  if (context.acceptanceCriteria.length === 0) throw new Error("CALL_CONTEXT_ACCEPTANCE_REQUIRED");
  return canonicalValue({
    missionId: context.missionId,
    taskId: context.taskId,
    objective: context.objective,
    acceptanceCriteria: [...context.acceptanceCriteria],
    constraints: [...context.constraints],
    oppositionPlanHash: context.oppositionPlanHash,
    startingSha: context.startingSha,
  });
}

export async function computeAuthorityContextHash(context: CanonicalTaskContext): Promise<string> {
  const canonicalJson = canonicalizeTaskContext(context);
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) throw new Error("CALL_CONTEXT_CRYPTO_UNAVAILABLE");
  const bytes = new TextEncoder().encode(canonicalJson);
  const digest = await cryptoApi.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createAuthorityContextArtifact(
  context: CanonicalTaskContext,
  policyVersion: string,
  clock: () => number = () => Date.now(),
): Promise<AuthorityContextArtifact> {
  required(policyVersion, "CALL_CONTEXT_POLICY_VERSION_REQUIRED");
  const canonicalJson = canonicalizeTaskContext(context);
  const sharedContextHash = await computeAuthorityContextHash(context);
  if (!SHA256.test(sharedContextHash)) throw new Error("CALL_CONTEXT_HASH_INVALID");
  return Object.freeze({
    taskId: context.taskId,
    policyVersion,
    context: Object.freeze({...context, acceptanceCriteria: Object.freeze([...context.acceptanceCriteria]), constraints: Object.freeze([...context.constraints])}),
    canonicalJson,
    sharedContextHash,
    createdAtMs: clock(),
  });
}
