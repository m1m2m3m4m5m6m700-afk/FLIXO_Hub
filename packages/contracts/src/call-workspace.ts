export const CALL_WORKSPACE_CONTRACT_VERSION = "1.0.0" as const;

export type CellWorkspace = Readonly<{
  workspaceId: string;
  agentId: string;
  role: "SOLVER" | "OPPONENT" | "RED_TEAM" | "VERIFIER";
  baseSha: string;
  filesystemRoot: string;
  network: "DENY" | "ALLOWLIST";
  pushTargets: readonly string[];
  capabilities: readonly string[];
}>;

const SHA = /^[0-9a-f]{40}$/iu;

export function validateCellWorkspace(workspace: CellWorkspace): void {
  if (!workspace.workspaceId.trim()) throw new Error("WORKSPACE_ID_REQUIRED");
  if (!workspace.agentId.trim()) throw new Error("WORKSPACE_AGENT_REQUIRED");
  if (!SHA.test(workspace.baseSha)) throw new Error("WORKSPACE_BASE_SHA_INVALID");
  if (!workspace.filesystemRoot.trim()) throw new Error("WORKSPACE_ROOT_REQUIRED");
  if (workspace.network === "DENY" && workspace.pushTargets.length > 0) {
    throw new Error("WORKSPACE_NETWORK_PUSH_CONFLICT");
  }
  if (workspace.pushTargets.some((target) => target === "main" || target === "refs/heads/main")) {
    throw new Error("WORKSPACE_MAIN_PUSH_FORBIDDEN");
  }
  if (new Set(workspace.capabilities).size !== workspace.capabilities.length) {
    throw new Error("WORKSPACE_CAPABILITY_DUPLICATE");
  }
}

export function assertWorkspaceIsolation(
  actor: CellWorkspace,
  target: CellWorkspace,
  writePath: string,
): void {
  validateCellWorkspace(actor);
  validateCellWorkspace(target);
  if (actor.workspaceId === target.workspaceId && actor.agentId !== target.agentId) {
    throw new Error("WORKSPACE_IDENTITY_COLLISION");
  }
  if (actor.workspaceId !== target.workspaceId && writePath.startsWith(target.filesystemRoot)) {
    throw new Error("CROSS_WORKSPACE_WRITE_FORBIDDEN");
  }
}

export function canWorkspacePush(workspace: CellWorkspace, branch: string): boolean {
  validateCellWorkspace(workspace);
  return branch !== "main" && branch !== "refs/heads/main" && workspace.pushTargets.includes(branch);
}
