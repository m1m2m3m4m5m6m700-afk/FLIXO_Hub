import { createHash } from "node:crypto";

export const CELL_CONTEXT_CONTRACT_VERSION = "1.0.0" as const;

export type CanonicalCellTaskContext = Readonly<{
  missionId: string;
  objective: string;
  acceptanceCriteria: readonly string[];
  constraints: readonly string[];
  startingSha: string;
}>;

export type CellContextArtifact = Readonly<{
  taskId: string;
  context: CanonicalCellTaskContext;
  canonicalJson: string;
  contextHash: string;
}>;

const SHA_PATTERN = /^[0-9a-f]{40}$/iu;
const HASH_PATTERN = /^[0-9a-f]{64}$/iu;

function required(value: string, code: string): void {
  if (typeof value !== "string" || value.trim() === "") throw new Error(code);
}

function list(values: readonly string[], code: string): void {
  if (values.length === 0 || values.some((value) => typeof value !== "string" || value.trim() === "")) {
    throw new Error(code);
  }
}

export function canonicalizeCellTaskContext(context: CanonicalCellTaskContext): string {
  required(context.missionId, "CELL_CONTEXT_MISSION_REQUIRED");
  required(context.objective, "CELL_CONTEXT_OBJECTIVE_REQUIRED");
  list(context.acceptanceCriteria, "CELL_CONTEXT_ACCEPTANCE_REQUIRED");
  list(context.constraints, "CELL_CONTEXT_CONSTRAINTS_REQUIRED");
  if (!SHA_PATTERN.test(context.startingSha)) throw new Error("CELL_CONTEXT_START_SHA_INVALID");

  return JSON.stringify({
    missionId: context.missionId.trim(),
    objective: context.objective.trim(),
    acceptanceCriteria: [...context.acceptanceCriteria].map((value) => value.trim()),
    constraints: [...context.constraints].map((value) => value.trim()),
    startingSha: context.startingSha,
  });
}

export function computeCellContextHash(context: CanonicalCellTaskContext): string {
  return createHash("sha256").update(canonicalizeCellTaskContext(context), "utf8").digest("hex");
}

export function createCellContextArtifact(taskId: string, context: CanonicalCellTaskContext): CellContextArtifact {
  required(taskId, "CELL_CONTEXT_TASK_REQUIRED");
  const canonicalJson = canonicalizeCellTaskContext(context);
  return Object.freeze({
    taskId: taskId.trim(),
    context: Object.freeze({
      ...context,
      missionId: context.missionId.trim(),
      objective: context.objective.trim(),
      acceptanceCriteria: Object.freeze([...context.acceptanceCriteria]),
      constraints: Object.freeze([...context.constraints]),
    }),
    canonicalJson,
    contextHash: createHash("sha256").update(canonicalJson, "utf8").digest("hex"),
  });
}

export function assertCellContextHash(context: CanonicalCellTaskContext, expectedHash: string): void {
  if (!HASH_PATTERN.test(expectedHash) || computeCellContextHash(context) !== expectedHash) {
    throw new Error("CELL_CONTEXT_HASH_MISMATCH");
  }
}
