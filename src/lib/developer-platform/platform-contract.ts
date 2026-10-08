export type PlatformCapabilityFamily =
  | 'workspace'
  | 'repository'
  | 'execution'
  | 'verification'
  | 'agents'
  | 'artifacts'
  | 'collaboration'
  | 'contribution'
  | 'learning';

export type PlatformCapabilityState = 'FOUNDATION' | 'INTEGRATED' | 'EXTERNAL' | 'BLOCKED';

export type PlatformExecutionMode = 'READ_ONLY' | 'TARGETED_VERIFY' | 'MUTATING';

export type NetworkPolicy =
  | Readonly<{ mode: 'NONE' }>
  | Readonly<{ mode: 'ALLOWLIST'; hosts: readonly string[] }>;

export type ResourceLimits = Readonly<{
  timeoutMs: number;
  memoryMb: number;
  cpuSeconds: number;
  outputMb: number;
}>;

export type ProgrammingProjectManifest = Readonly<{
  projectId: string;
  name: string;
  primaryLanguage: string;
  sourceControl: 'github' | 'none';
  workspaceMode: 'browser-local' | 'remote-sandbox' | 'hybrid';
  defaultBranch: string;
}>;

export type PlatformSource = Readonly<{
  type: 'git';
  url: string;
  revision: string;
  depth?: number;
}>;

export type PlatformExecutionRequest = Readonly<{
  projectId: string;
  taskId: string;
  agentId: string;
  sessionId: string;
  startSha: string;
  sourceSha: string;
  command: string;
  args: readonly string[];
  cwd: string;
  environmentKeys: readonly string[];
  network: NetworkPolicy;
  limits: ResourceLimits;
  expectedArtifacts: readonly string[];
  source?: PlatformSource;
}>;

export type PlatformExecutionDecision =
  | Readonly<{ admitted: true; reason: 'READ_ONLY' | 'TARGETED_VERIFY' | 'MUTATING' }>
  | Readonly<{
      admitted: false;
      code:
        | 'INVALID_TASK_ID'
        | 'INVALID_AGENT_ID'
        | 'INVALID_SESSION_ID'
        | 'INVALID_SHA'
        | 'SHA_DRIFT'
        | 'INVALID_COMMAND'
        | 'INVALID_CWD'
        | 'INVALID_NETWORK_POLICY'
        | 'INVALID_LIMITS'
        | 'INVALID_ENVIRONMENT_KEYS'
        | 'INVALID_ARTIFACT_REQUEST'
        | 'INVALID_SOURCE';
    }>;

export const DEFAULT_PROGRAMMING_LIMITS: ResourceLimits = Object.freeze({
  timeoutMs: 10 * 60 * 1000,
  memoryMb: 1024,
  cpuSeconds: 300,
  outputMb: 32,
});

const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const TASK_PATTERN = /^EXEC-[A-Z0-9-]{3,}$/;
const AGENT_PATTERN = /^[A-Za-z0-9._:-]{2,96}$/;
const SESSION_PATTERN = /^[A-Za-z0-9._:-]{2,128}$/;
const SAFE_ENVIRONMENT_KEY = /^[A-Z_][A-Z0-9_]{0,127}$/;
const SAFE_ARTIFACT_KIND = /^[a-z0-9][a-z0-9._-]{0,63}$/;

const isPositiveFinite = (value: number): boolean => Number.isFinite(value) && value > 0;

export function evaluatePlatformExecution(
  request: PlatformExecutionRequest,
  currentSha: string,
): PlatformExecutionDecision {
  if (!TASK_PATTERN.test(request.taskId)) return { admitted: false, code: 'INVALID_TASK_ID' };
  if (!AGENT_PATTERN.test(request.agentId)) return { admitted: false, code: 'INVALID_AGENT_ID' };
  if (!SESSION_PATTERN.test(request.sessionId)) return { admitted: false, code: 'INVALID_SESSION_ID' };
  if (!SHA_PATTERN.test(request.startSha) || !SHA_PATTERN.test(request.sourceSha) || !SHA_PATTERN.test(currentSha)) {
    return { admitted: false, code: 'INVALID_SHA' };
  }
  if (request.startSha.toLowerCase() !== currentSha.toLowerCase() || request.sourceSha.toLowerCase() !== currentSha.toLowerCase()) {
    return { admitted: false, code: 'SHA_DRIFT' };
  }
  if (!request.command.trim() || request.command.length > 256) return { admitted: false, code: 'INVALID_COMMAND' };
  if (!request.cwd.startsWith('/') || request.cwd.includes('..')) return { admitted: false, code: 'INVALID_CWD' };
  if (request.network.mode === 'ALLOWLIST') {
    if (
      request.network.hosts.length === 0 ||
      request.network.hosts.some((host) => !/^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(host))
    ) {
      return { admitted: false, code: 'INVALID_NETWORK_POLICY' };
    }
  }
  if (
    !Number.isInteger(request.limits.timeoutMs) ||
    !Number.isInteger(request.limits.memoryMb) ||
    !Number.isInteger(request.limits.cpuSeconds) ||
    !Number.isInteger(request.limits.outputMb) ||
    request.limits.timeoutMs < 1 ||
    request.limits.timeoutMs > DEFAULT_PROGRAMMING_LIMITS.timeoutMs ||
    request.limits.memoryMb < 64 ||
    request.limits.memoryMb > 4096 ||
    request.limits.cpuSeconds < 1 ||
    request.limits.cpuSeconds > 900 ||
    request.limits.outputMb < 1 ||
    request.limits.outputMb > 128 ||
    !isPositiveFinite(request.limits.timeoutMs)
  ) {
    return { admitted: false, code: 'INVALID_LIMITS' };
  }
  if (request.source) {
    if (request.source.type !== 'git' || !/^https:\/\/[^/@?#\\s]+(?:\/[^?#\\s]*)?$/u.test(request.source.url) || !SHA_PATTERN.test(request.source.revision)) {
      return { admitted: false, code: 'INVALID_SOURCE' };
    }
    if (request.source.depth !== undefined && (!Number.isInteger(request.source.depth) || request.source.depth < 1 || request.source.depth > 100)) {
      return { admitted: false, code: 'INVALID_SOURCE' };
    }
  }
  if (request.environmentKeys.some((key) => !SAFE_ENVIRONMENT_KEY.test(key))) {
    return { admitted: false, code: 'INVALID_ENVIRONMENT_KEYS' };
  }
  if (request.expectedArtifacts.some((kind) => !SAFE_ARTIFACT_KIND.test(kind))) {
    return { admitted: false, code: 'INVALID_ARTIFACT_REQUEST' };
  }
  const reason = request.command.startsWith('git ') || request.command.includes('npm test') ? 'TARGETED_VERIFY' : 'READ_ONLY';
  return { admitted: true, reason };
}
