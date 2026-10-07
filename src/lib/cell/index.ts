import { getCapability } from "@/config/manual-capability-definition.ts";
import { sha256 } from "./integrity.ts";
import { admitCellAction, validateCellEnvelope } from "./hard-control.ts";
import { CELL_POLICY_VERSION, type CellAdmissionDecision, type CellExecutionEnvelope } from "./types.ts";

export * from "./types.ts";
export * from "./hard-control.ts";
export * from "./integrity.ts";

export type CanonicalCellContext = Readonly<{
  agentId?: string;
  taskId?: string;
  executionId?: string;
  repository?: string;
  baseSha?: string;
  currentSha?: string;
  branch?: string;
  objective?: unknown;
  acceptance?: unknown;
  authority?: CellExecutionEnvelope["authority"];
}>;

const DEFAULT_REPOSITORY = "FLIXO_Hub";
const DEFAULT_BRANCH = "execution";

export async function createCanonicalCellEnvelope(
  toolId: string,
  parameters: Readonly<Record<string, unknown>>,
  context: CanonicalCellContext = {},
): Promise<CellExecutionEnvelope> {
  const capability = getCapability(toolId);
  if (!capability) throw new Error("CELL_DENIED:UNKNOWN_CAPABILITY: " + toolId);

  const objective = context.objective ?? { kind: "canonical-tool-execution", toolId };
  const acceptance = context.acceptance ?? {
    kind: "canonical-output-contract",
    toolId,
    requireVerifier: true,
  };
  const baseSha = context.baseSha ?? "0000000000000000000000000000000000000000";
  const currentSha = context.currentSha ?? baseSha;

  return Object.freeze({
    executionId: context.executionId ?? `cell-${toolId}-${Date.now()}`,
    taskId: context.taskId ?? `canonical:${toolId}`,
    agentId: context.agentId ?? "interactive-user",
    repository: context.repository ?? DEFAULT_REPOSITORY,
    baseSha,
    currentSha,
    branch: context.branch ?? DEFAULT_BRANCH,
    objectiveDigest: await sha256(objective),
    acceptanceDigest: await sha256(acceptance),
    policyVersion: CELL_POLICY_VERSION,
    authority: context.authority ?? "IMPLEMENTER",
    capabilities: Object.freeze([toolId]),
    scopes: Object.freeze([`capability:${toolId}`]),
    forbiddenActions: Object.freeze([
      "CELL_POLICY_MUTATION",
      "AUTHORITY_ESCALATION",
      "SCOPE_EXPANSION",
      "UNVERIFIED_PROMOTION",
    ]),
    budget: Object.freeze({
      maxAttempts: Math.min(3, Math.max(1, capability.recovery.maxAttempts)),
      maxDelegationDepth: 2,
      maxChildren: 4,
      timeoutMs: capability.safetyLimits.timeoutMs,
    }),
    evidence: Object.freeze({
      requireExecutionId: true,
      requireExactSha: true,
      requireVerifier: true,
      requireEvidenceDigest: false,
    }),
  });
}

export async function admitCanonicalExecution(
  toolId: string,
  parameters: Readonly<Record<string, unknown>>,
  context: CanonicalCellContext = {},
): Promise<Readonly<{ envelope: CellExecutionEnvelope; decision: CellAdmissionDecision }>> {
  const envelope = await createCanonicalCellEnvelope(toolId, parameters, context);
  const decision = admitCellAction(envelope, {
    action: "CANONICAL_TOOL_EXECUTION",
    capability: toolId,
    scope: `capability:${toolId}`,
    repository: envelope.repository,
    currentSha: envelope.currentSha,
    objectiveDigest: envelope.objectiveDigest,
    acceptanceDigest: envelope.acceptanceDigest,
    evidenceRequested: false,
  });
  return Object.freeze({ envelope, decision });
}

export function assertValidCellEnvelope(envelope: CellExecutionEnvelope): void {
  const decision = validateCellEnvelope(envelope);
  if (!decision.allowed) throw new Error(`CELL_DENIED:${decision.code}: ${decision.reason}`);
}
