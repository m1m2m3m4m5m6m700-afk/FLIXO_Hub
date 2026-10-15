export const CALL_OPPOSITION_VERSION = "1.0.0" as const;

export type OppositionContract = Readonly<{
  targetClaim: string;
  targetSha: string;
  attackSurface: readonly string[];
  falsificationQuestions: readonly string[];
  requiredCounterexamples: readonly string[];
  minimumEvidence: readonly string[];
  independenceProof: string;
  disclosureBarrier: "LOCKED_UNTIL_OPPONENT_START";
}>;

export function validateOppositionContract(contract: OppositionContract): void {
  if (!contract.targetClaim || !contract.targetSha) throw new Error("OPPOSITION_SCHEMA_INVALID");
  if (!/^[0-9a-f]{40}$/iu.test(contract.targetSha)) throw new Error("OPPOSITION_SHA_INVALID");
  if (!contract.attackSurface.length || !contract.falsificationQuestions.length) throw new Error("OPPOSITION_ATTACK_SURFACE_REQUIRED");
  if (!contract.requiredCounterexamples.length || !contract.minimumEvidence.length) throw new Error("OPPOSITION_CHALLENGE_DEPTH_REQUIRED");
  if (!contract.independenceProof) throw new Error("OPPOSITION_INDEPENDENCE_PROOF_REQUIRED");
  if (contract.disclosureBarrier !== "LOCKED_UNTIL_OPPONENT_START") throw new Error("OPPOSITION_DISCLOSURE_BREACH");
}
