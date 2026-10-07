import type { CellAuthority } from "./types.ts";

export function attenuateAuthority(parent: CellAuthority, requestedCapabilities: readonly string[], requestedScopes: readonly string[]): CellAuthority {
  const capabilities = requestedCapabilities.filter((id) => parent.capabilities.includes(id));
  const scopes = requestedScopes.filter((scope) => parent.scopes.includes(scope));
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
