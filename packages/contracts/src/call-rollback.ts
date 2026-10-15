export const CALL_ROLLBACK_VERSION = "1.0.0" as const;

export type ArtifactDisposition = "ACTIVE" | "SUPERSEDED" | "RETIRED" | "REJECTED" | "INVALIDATED";

export type RollbackContract = Readonly<{
  artifactId: string;
  producedBy: string;
  gate: string;
  dependsOn: readonly string[];
  reversible: boolean;
  rollbackAction: string;
  rollbackAuthority: string;
  dependentArtifacts: readonly string[];
  disposition: ArtifactDisposition;
}>;

export function validateRollbackContract(contract: RollbackContract): void {
  if (!contract.artifactId || !contract.producedBy || !contract.gate || !contract.rollbackAction || !contract.rollbackAuthority) {
    throw new Error("ROLLBACK_CONTRACT_INVALID");
  }
  if (!contract.reversible && contract.rollbackAction !== "NONE") throw new Error("IRREVERSIBLE_ROLLBACK_MISMATCH");
}
