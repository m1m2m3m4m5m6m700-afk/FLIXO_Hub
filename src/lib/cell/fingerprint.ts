import { TOOL_CATALOG } from "@/config/registry.ts";

export function getCellPolicyFingerprint(): string {
  const ids = [...TOOL_CATALOG.byId.keys()].sort().join("|");
  const ready = [...TOOL_CATALOG.byId.values()]
    .map((tool) => [tool.id, tool.isReady, tool.operational.executorId, tool.operational.outputContractId, tool.executionMode, tool.requirements.network].join(":"))
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
