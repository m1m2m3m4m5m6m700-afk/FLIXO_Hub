import { getCapability } from "@/config/manual-capability-definition.ts";
import { getToolById } from "@/config/registry.ts";
import { getCellPolicyFingerprint } from "./fingerprint.ts";
import type { CellAdmissionDecision, CellAdmissionRequest } from "./types.ts";

const MAX_CHAIN_DEPTH = 4;
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;

export function admitExecution(request: CellAdmissionRequest): CellAdmissionDecision {
  if (!REQUEST_ID.test(request.requestId) || !REQUEST_ID.test(request.taskId)) {
    return deny("INVALID_REQUEST_ID", "requestId/taskId must be bounded identifiers", request.capabilityId);
  }
  if (!request.scope.trim() || request.scope.length > 256) {
    return deny("INVALID_SCOPE", "execution scope is missing or oversized", request.capabilityId);
  }
  if (request.signal?.aborted) return deny("ABORTED", "execution was already cancelled", request.capabilityId);

  const tool = getToolById(request.capabilityId);
  const capability = getCapability(request.capabilityId);
  if (!tool || !capability) return deny("UNKNOWN_CAPABILITY", "capability is not in the canonical registry", request.capabilityId);
  if (capability.state !== "EXECUTABLE") return deny("CAPABILITY_NOT_EXECUTABLE", "capability is not executable", request.capabilityId);
  if (!tool.isReady) return deny("CAPABILITY_NOT_READY", "capability is not release-ready", request.capabilityId);
  if (tool.operational.executorId !== request.capabilityId) return deny("EXECUTOR_BINDING_MISMATCH", "executor binding is not canonical", request.capabilityId);
  if (tool.operational.outputContractId !== request.capabilityId) return deny("OUTPUT_CONTRACT_BINDING_MISMATCH", "output contract binding is not canonical", request.capabilityId);
  if (tool.executionMode !== "LOCAL") return deny("NON_LOCAL_EXECUTION", "CELL only admits browser-local execution in this runtime", request.capabilityId);
  if (tool.requirements.network) return deny("NETWORK_REQUIRED", "network-dependent execution is outside this CELL boundary", request.capabilityId);

  const attempts = Math.floor(request.maxAttempts);
  if (!Number.isFinite(attempts) || attempts < 1 || attempts > Math.min(3, capability.recovery.maxAttempts)) {
    return deny("BUDGET_EXCEEDED", "retry budget exceeds the canonical capability budget", request.capabilityId);
  }
  const depth = request.chainDepth ?? 1;
  if (!Number.isInteger(depth) || depth < 1 || depth > MAX_CHAIN_DEPTH) {
    return deny("CHAIN_LIMIT_EXCEEDED", "execution chain exceeds the hard depth limit", request.capabilityId);
  }

  if (request.authority) {
    if (request.authority.agentId.length < 1 || request.authority.agentId.length > 128) {
      return deny("INVALID_SCOPE", "agent identity is invalid", request.capabilityId);
    }
    if (!request.authority.capabilities.includes(request.capabilityId)) {
      return deny("CAPABILITY_NOT_EXECUTABLE", "authority does not contain the admitted capability", request.capabilityId);
    }
    if (!request.authority.scopes.includes(request.scope)) {
      return deny("INVALID_SCOPE", "authority does not contain the requested scope", request.capabilityId);
    }
  }

  return Object.freeze({ decision: "ALLOW", capabilityId: request.capabilityId, policyFingerprint: getCellPolicyFingerprint() });
}

function deny(code: Parameters<typeof Object.freeze>[0] extends never ? never : any, reason: string, capabilityId: string): CellAdmissionDecision {
  return Object.freeze({ decision: "DENY", code, reason, capabilityId });
}
