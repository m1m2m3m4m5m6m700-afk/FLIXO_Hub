export const CALL_GATE_A_VERSION = "1.0.0" as const;

export type GateAObservation = Readonly<{
  sha: string;
  admitted: boolean;
  opponentStartedBeforeDisclosure: boolean;
  exactShaBound: boolean;
  reconciliationRecorded: boolean;
  redTeamSeparate: boolean;
  independentVerification: boolean;
  provenancePreserved: boolean;
  failureClosed: boolean;
}>;

const invariantKeys = [
  "admitted","opponentStartedBeforeDisclosure","exactShaBound","reconciliationRecorded",
  "redTeamSeparate","independentVerification","provenancePreserved","failureClosed",
] as const;

export function validateGateAObservation(observation: GateAObservation): void {
  if (!/^[0-9a-f]{40}$/iu.test(observation.sha)) throw new Error("GATE_A_SHA_INVALID");
  if (invariantKeys.some((key) => observation[key] !== true)) throw new Error("GATE_A_INVARIANT_FAILED");
}

export function compareGateAWaves(
  first: GateAObservation,
  second: GateAObservation,
): Readonly<{passed: boolean; reason: string}> {
  validateGateAObservation(first);
  validateGateAObservation(second);
  if (first.sha === second.sha) throw new Error("GATE_A_REQUIRES_DISTINCT_SHAS");
  return Object.freeze({passed: true, reason: "protocol invariants hold on two distinct SHAs"});
}
