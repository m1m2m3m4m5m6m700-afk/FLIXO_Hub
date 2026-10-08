import type { CellAuthority } from "./types.ts";

export function attenuateAuthority(parent: CellAuthority, requestedCapabilities: readonly string[], requestedScopes: readonly string[]): CellAuthority {
  if (!canDelegate(parent, requestedCapabilities, requestedScopes)) {
    throw new Error("CELL delegation denied: requested authority exceeds parent authority.");
  }
  const capabilities = [...new Set(requestedCapabilities)];
  const scopes = [...new Set(requestedScopes)];
  return Object.freeze({
    agentId: parent.agentId + ":child",
    parentAgentId: parent.agentId,
    role: "assistant",
    capabilities: Object.freeze([...new Set(capabilities)]),
    scopes: Object.freeze([...new Set(scopes)]),
  });
}

export function canDelegate(parent: CellAuthority, capabilities: readonly string[], scopes: readonly string[]): boolean {
  return capabilities.every((id) => parent.capabilities.includes(id)) &&
    scopes.every((scope) => parent.scopes.includes(scope));
}
