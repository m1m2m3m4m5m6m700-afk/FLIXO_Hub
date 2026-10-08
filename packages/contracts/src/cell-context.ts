import { createHash } from "node:crypto";

export const CELL_CONTEXT_CONTRACT_VERSION = "1.0.0" as const;

export type CellContextInput = Readonly<{
  missionId: string;
  objective: string;
  acceptanceCriteria: readonly string[];
  startingSha: string;
  taskId: string;
}>;

export type CellContextArtifact = Readonly<{
  contractVersion: typeof CELL_CONTEXT_CONTRACT_VERSION;
  taskId: string;
  artifactPath: string;
  missionId: string;
  objective: string;
  acceptanceCriteria: readonly string[];
  startingSha: string;
  hashAlgorithm: "SHA-256";
  canonicalHashInput: string;
  sharedContextHash: string;
  authorityOwned: true;
}>;

const SHA1 = /^[0-9a-f]{40}$/iu;
const SHA256 = /^[0-9a-f]{64}$/iu;

function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(record)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + canonical(record[key]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function required(value: string, code: string): void {
  if (typeof value !== "string" || value.trim() === "") throw new Error(code);
}

function requiredList(values: readonly string[], code: string): void {
  if (values.length === 0 || values.some((value) => typeof value !== "string" || value.trim() === "")) {
    throw new Error(code);
  }
}

export function createCellContextArtifact(input: CellContextInput): CellContextArtifact {
  required(input.taskId, "CELL_CONTEXT_TASK_REQUIRED");
  required(input.missionId, "CELL_CONTEXT_MISSION_REQUIRED");
  required(input.objective, "CELL_CONTEXT_OBJECTIVE_REQUIRED");
  requiredList(input.acceptanceCriteria, "CELL_CONTEXT_ACCEPTANCE_REQUIRED");
  if (!SHA1.test(input.startingSha)) throw new Error("CELL_CONTEXT_START_SHA_INVALID");

  const canonicalHashInput = canonical({
    missionId: input.missionId.trim(),
    objective: input.objective.trim(),
    acceptanceCriteria: [...input.acceptanceCriteria].map((value) => value.trim()),
    startingSha: input.startingSha,
  });
  const sharedContextHash = sha256Hex(canonicalHashInput);
  if (!SHA256.test(sharedContextHash)) throw new Error("CELL_CONTEXT_HASH_GENERATION_FAILED");

  return Object.freeze({
    contractVersion: CELL_CONTEXT_CONTRACT_VERSION,
    taskId: input.taskId.trim(),
    artifactPath: `.cell/context/${input.taskId.trim()}.json`,
    missionId: input.missionId.trim(),
    objective: input.objective.trim(),
    acceptanceCriteria: Object.freeze([...input.acceptanceCriteria].map((value) => value.trim())),
    startingSha: input.startingSha,
    hashAlgorithm: "SHA-256" as const,
    canonicalHashInput,
    sharedContextHash,
    authorityOwned: true as const,
  });
}

export function serializeCellContextArtifact(artifact: CellContextArtifact): string {
  return JSON.stringify(artifact, null, 2) + "\n";
}
