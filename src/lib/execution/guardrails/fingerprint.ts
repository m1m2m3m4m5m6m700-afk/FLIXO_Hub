import { CAPABILITY_DEFINITIONS } from "@/config/manual-capability-definition.ts";

export function getCellPolicyFingerprint(): string {
  const ids = CAPABILITY_DEFINITIONS.map((definition) => definition.id).sort().join("|");
  const ready = CAPABILITY_DEFINITIONS
    .map((definition) => [
      definition.id,
      definition.state === "EXECUTABLE",
      definition.operational.executorId,
      definition.operational.outputContractId,
      definition.executionMode,
      definition.requirements.network,
    ].join(":"))
    .sort()
    .join("|");
  return stableHash(ids + "::" + ready);
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
