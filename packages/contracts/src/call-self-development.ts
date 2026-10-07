export const CALL_SELF_DEVELOPMENT_VERSION = "1.0.0" as const;

export type CapabilityObservation = Readonly<{
  capabilityId: string;
  maturity: number;
  evidenceRefs: readonly string[];
}>;

export type ReferenceCapability = Readonly<{
  capabilityId: string;
  maturity: number;
  referenceId: string;
  evidenceRefs: readonly string[];
}>;

export type CapabilityGap = Readonly<{
  gapId: string;
  capabilityId: string;
  observedMaturity: number;
  referenceMaturity: number;
  delta: number;
  referenceIds: readonly string[];
  evidenceRefs: readonly string[];
}>;

export type SelfDevelopmentObjective = Readonly<{
  objectiveId: string;
  objective: string;
  sourceGapIds: readonly string[];
  referenceIds: readonly string[];
  acceptanceCriteria: readonly string[];
  generatedAtMs: number;
  status: "PROPOSED" | "ADMITTED" | "ASSIGNED" | "COMPLETED" | "REJECTED";
}>;

function finiteUnit(value: number, code: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(code);
}

function required(value: string, code: string): void {
  if (typeof value !== "string" || value.trim() === "") throw new Error(code);
}

export function detectCapabilityGaps(
  observed: readonly CapabilityObservation[],
  reference: readonly ReferenceCapability[],
  minimumGap = 0.05,
): readonly CapabilityGap[] {
  if (!Number.isFinite(minimumGap) || minimumGap < 0 || minimumGap > 1) {
    throw new Error("SELF_DEVELOPMENT_GAP_THRESHOLD_INVALID");
  }

  const observedById = new Map<string, CapabilityObservation>();
  for (const item of observed) {
    required(item.capabilityId, "CAPABILITY_ID_REQUIRED");
    finiteUnit(item.maturity, "CAPABILITY_MATURITY_INVALID");
    if (item.evidenceRefs.length === 0) throw new Error("CAPABILITY_EVIDENCE_REQUIRED");
    observedById.set(item.capabilityId, item);
  }

  const gaps: CapabilityGap[] = [];
  for (const target of reference) {
    required(target.capabilityId, "REFERENCE_CAPABILITY_ID_REQUIRED");
    required(target.referenceId, "REFERENCE_ID_REQUIRED");
    finiteUnit(target.maturity, "REFERENCE_MATURITY_INVALID");
    if (target.evidenceRefs.length === 0) throw new Error("REFERENCE_EVIDENCE_REQUIRED");

    const current = observedById.get(target.capabilityId);
    const observedMaturity = current?.maturity ?? 0;
    const delta = target.maturity - observedMaturity;
    if (delta >= minimumGap) {
      gaps.push(Object.freeze({
        gapId: `GAP-${target.capabilityId}`,
        capabilityId: target.capabilityId,
        observedMaturity,
        referenceMaturity: target.maturity,
        delta,
        referenceIds: Object.freeze([target.referenceId]),
        evidenceRefs: Object.freeze([
          ...(current?.evidenceRefs ?? []),
          ...target.evidenceRefs,
        ]),
      }));
    }
  }
  return Object.freeze(gaps);
}

export function generateSelfDevelopmentObjective(
  gaps: readonly CapabilityGap[],
  nowMs: number,
): SelfDevelopmentObjective {
  if (gaps.length === 0) throw new Error("SELF_DEVELOPMENT_NO_GAP");
  if (!Number.isFinite(nowMs)) throw new Error("SELF_DEVELOPMENT_TIME_INVALID");

  const sourceGapIds = [...new Set(gaps.map((gap) => gap.gapId))];
  const referenceIds = [...new Set(gaps.flatMap((gap) => gap.referenceIds))];
  const capabilityIds = [...new Set(gaps.map((gap) => gap.capabilityId))];

  if (sourceGapIds.length === 0 || referenceIds.length === 0) {
    throw new Error("SELF_DEVELOPMENT_PROVENANCE_REQUIRED");
  }

  const acceptanceCriteria = gaps.map(
    (gap) => `reach capability ${gap.capabilityId} maturity >= ${gap.referenceMaturity.toFixed(3)} with independent evidence`,
  );

  return Object.freeze({
    objectiveId: `SELF-DEV-${sourceGapIds.join("-")}`,
    objective: `Close validated capability gaps: ${capabilityIds.join(", ")}`,
    sourceGapIds: Object.freeze(sourceGapIds),
    referenceIds: Object.freeze(referenceIds),
    acceptanceCriteria: Object.freeze(acceptanceCriteria),
    generatedAtMs: nowMs,
    status: "PROPOSED" as const,
  });
}

export function validateSelfDevelopmentObjective(
  objective: SelfDevelopmentObjective,
  knownGaps: readonly CapabilityGap[],
): void {
  required(objective.objectiveId, "SELF_DEVELOPMENT_OBJECTIVE_ID_REQUIRED");
  required(objective.objective, "SELF_DEVELOPMENT_OBJECTIVE_REQUIRED");
  if (!["PROPOSED", "ADMITTED", "ASSIGNED", "COMPLETED", "REJECTED"].includes(objective.status)) throw new Error("SELF_DEVELOPMENT_OBJECTIVE_STATUS_INVALID");
  if (objective.sourceGapIds.length === 0 || objective.referenceIds.length === 0) {
    throw new Error("SELF_DEVELOPMENT_PROVENANCE_REQUIRED");
  }
  if (objective.acceptanceCriteria.length === 0) {
    throw new Error("SELF_DEVELOPMENT_ACCEPTANCE_REQUIRED");
  }
  const known = new Set(knownGaps.map((gap) => gap.gapId));
  if (objective.sourceGapIds.some((id) => !known.has(id))) {
    throw new Error("SELF_DEVELOPMENT_GAP_NOT_FOUND");
  }
}
