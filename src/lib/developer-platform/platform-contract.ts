import {
  authorizeExecutionAction,
  matchesScope,
  verifyExecutionIdentity,
  type BudgetUsage,
  type ExecutionEnvelope,
} from '../../../packages/contracts/src/cell-hard-control.ts';

export type PlatformCapabilityFamily =
  | 'workspace' | 'repository' | 'execution' | 'verification' | 'agents'
  | 'artifacts' | 'collaboration' | 'contribution' | 'learning';

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

export type PlatformTaskAuthorityProjection = Readonly<{
  taskId: string;
  status: 'QUEUED' | 'IN_PROGRESS' | 'VERIFYING';
  agentId: string;
  missionId: string;
  allowedBranch: string;
  sourceSha: string;
  capability: string;
}>;

export type PlatformExecutionAuthorityContext = Readonly<{
  source: 'CANONICAL_CELL_RUNTIME';
  task: PlatformTaskAuthorityProjection | null;
  agentState: 'READY' | 'WORKING';
  envelope: ExecutionEnvelope;
  currentSha: string;
  executionPath: string;
  cwdRoot: string;
  networkPolicy: NetworkPolicy;
  resourceLimits: ResourceLimits;
  allowedEnvironmentKeys: readonly string[];
  allowedArtifactKinds: readonly string[];
  usage: BudgetUsage;
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
  | Readonly<{ admitted: true; reason: 'READ_ONLY' | 'TARGETED_VERIFY' }>
  | Readonly<{
      admitted: false;
      code:
        | 'INVALID_AUTHORITY_CONTEXT' | 'TASK_NOT_ADMITTED' | 'AGENT_NOT_AUTHORIZED'
        | 'INVALID_TASK_ID' | 'INVALID_AGENT_ID' | 'INVALID_SESSION_ID'
        | 'INVALID_SHA' | 'SHA_DRIFT' | 'MISSION_MISMATCH' | 'BRANCH_NOT_ALLOWED'
        | 'CAPABILITY_NOT_ALLOWED' | 'OBJECTIVE_DRIFT' | 'ACCEPTANCE_DRIFT'
        | 'EXPECTED_OUTPUT_MISMATCH' | 'FORBIDDEN_ACTION' | 'INVALID_COMMAND'
        | 'COMMAND_NOT_ALLOWLISTED' | 'INVALID_CWD' | 'INVALID_NETWORK_POLICY'
        | 'INVALID_LIMITS' | 'INVALID_ENVIRONMENT_KEYS' | 'INVALID_ARTIFACT_REQUEST'
        | 'INVALID_SOURCE' | 'SCOPE_VIOLATION' | 'RESOURCE_DRIFT' | 'DELEGATION_DRIFT';
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
const SAFE_ARG = /^[A-Za-z0-9_./:@+=,-]+$/;
const SAFE_HOST = /^[a-z0-9.-]+(?::[0-9]{1,5})?$/i;

const READ_COMMANDS = new Set(['git status', 'git diff', 'git show', 'git rev-parse', 'npm --version', 'node --version']);
const VERIFY_COMMANDS = new Set([
  'npm test',
  'npm run test:hub',
  'npm run test:e2e',
  'npm run typecheck',
  'npm run lint',
  'npm run test:programming-platform',
  'npm run test:developer-platform',
  'npm run test:developer-workspace',
]);

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isSubset(values: readonly string[], allowed: readonly string[]): boolean {
  const allow = new Set(allowed.map((value) => value.trim().toLowerCase()));
  return values.every((value) => allow.has(value.trim().toLowerCase()));
}

function validNetworkRequest(request: NetworkPolicy, allowed: NetworkPolicy): boolean {
  if (request.mode === 'NONE') return true;
  if (allowed.mode !== 'ALLOWLIST' || request.hosts.length === 0) return false;
  if (request.hosts.some((host) => !SAFE_HOST.test(host))) return false;
  const allowedHosts = new Set(allowed.hosts.map((host) => host.trim().toLowerCase()));
  return request.hosts.every((host) => allowedHosts.has(host.trim().toLowerCase()));
}

function classifyCommand(command: string, args: readonly string[]): 'READ_ONLY' | 'TARGETED_VERIFY' | null {
  const normalized = command.trim();
  if (!normalized || normalized.length > 256 || !args.every((arg) => SAFE_ARG.test(arg))) return null;
  if (/[\u0000-\u001f\u007f;&|$\\x60<>]/u.test(normalized) || args.some((arg) => /[\u0000-\u001f\u007f;&|$\\x60<>]/u.test(arg))) return null;
  if (READ_COMMANDS.has(normalized)) return 'READ_ONLY';
  if (VERIFY_COMMANDS.has(normalized)) return 'TARGETED_VERIFY';
  return null;
}

export function evaluatePlatformExecution(
  request: PlatformExecutionRequest,
  currentSha: string,
  authority: PlatformExecutionAuthorityContext,
): PlatformExecutionDecision {
  if (authority.source !== 'CANONICAL_CELL_RUNTIME' || !authority.envelope || !authority.currentSha || !authority.task) {
    return { admitted: false, code: 'INVALID_AUTHORITY_CONTEXT' };
  }
  const task = authority.task;
  if (task.status === 'QUEUED') return { admitted: false, code: 'TASK_NOT_ADMITTED' };
  if (authority.agentState !== 'WORKING') return { admitted: false, code: 'AGENT_NOT_AUTHORIZED' };
  if (!TASK_PATTERN.test(request.taskId) || request.taskId !== task.taskId) return { admitted: false, code: 'INVALID_TASK_ID' };
  if (!AGENT_PATTERN.test(request.agentId) || request.agentId !== task.agentId) return { admitted: false, code: 'INVALID_AGENT_ID' };
  if (!SESSION_PATTERN.test(request.sessionId) || request.sessionId !== authority.envelope.sessionId) return { admitted: false, code: 'INVALID_SESSION_ID' };
  if (!SHA_PATTERN.test(request.startSha) || !SHA_PATTERN.test(request.sourceSha) || !SHA_PATTERN.test(currentSha)) return { admitted: false, code: 'INVALID_SHA' };

  const normalizedCurrent = currentSha.toLowerCase();
  if (
    request.startSha.toLowerCase() !== normalizedCurrent ||
    request.sourceSha.toLowerCase() !== normalizedCurrent ||
    authority.currentSha.toLowerCase() !== normalizedCurrent ||
    task.sourceSha.toLowerCase() !== normalizedCurrent ||
    authority.envelope.startSha.toLowerCase() !== normalizedCurrent
  ) return { admitted: false, code: 'SHA_DRIFT' };

  if (authority.envelope.missionId !== task.missionId) return { admitted: false, code: 'MISSION_MISMATCH' };
  if (authority.envelope.allowedBranch !== task.allowedBranch || task.allowedBranch === 'main') return { admitted: false, code: 'BRANCH_NOT_ALLOWED' };
  if (!authority.envelope.allowedCapabilities.includes(task.capability)) return { admitted: false, code: 'CAPABILITY_NOT_ALLOWED' };

  const identityError = verifyExecutionIdentity(authority.envelope, {
    taskId: request.taskId,
    agentId: request.agentId,
    sessionId: request.sessionId,
    missionId: task.missionId,
    branch: task.allowedBranch,
    startSha: request.startSha,
    currentSha,
    capability: task.capability,
    objectiveId: authority.envelope.normalizedObjectiveId,
    acceptanceDigest: authority.envelope.acceptanceDigest,
    expectedOutput: authority.envelope.expectedOutput,
  });
  if (identityError === 'OBJECTIVE_DRIFT') return { admitted: false, code: 'OBJECTIVE_DRIFT' };
  if (identityError === 'ACCEPTANCE_DRIFT') return { admitted: false, code: 'ACCEPTANCE_DRIFT' };
  if (identityError === 'EXPECTED_OUTPUT_MISMATCH') return { admitted: false, code: 'EXPECTED_OUTPUT_MISMATCH' };
  if (identityError === 'BRANCH_MISMATCH') return { admitted: false, code: 'BRANCH_NOT_ALLOWED' };
  if (identityError) return { admitted: false, code: 'INVALID_AUTHORITY_CONTEXT' };

  const reason = classifyCommand(request.command, request.args);
  if (!reason) return { admitted: false, code: request.command.trim() ? 'COMMAND_NOT_ALLOWLISTED' : 'INVALID_COMMAND' };
  if (reason === 'TARGETED_VERIFY' && !matchesScope(authority.executionPath, authority.envelope.readScope) && !matchesScope(authority.executionPath, authority.envelope.writeScope)) {
    return { admitted: false, code: 'SCOPE_VIOLATION' };
  }
  if (!request.cwd.startsWith(authority.cwdRoot) || request.cwd.includes('..')) return { admitted: false, code: 'INVALID_CWD' };
  if (!validNetworkRequest(request.network, authority.networkPolicy)) return { admitted: false, code: 'INVALID_NETWORK_POLICY' };

  const withinLimits =
    Number.isInteger(request.limits.timeoutMs) &&
    Number.isInteger(request.limits.memoryMb) &&
    Number.isInteger(request.limits.cpuSeconds) &&
    Number.isInteger(request.limits.outputMb) &&
    request.limits.timeoutMs >= 1 &&
    request.limits.memoryMb >= 64 &&
    request.limits.cpuSeconds >= 1 &&
    request.limits.outputMb >= 1 &&
    request.limits.timeoutMs <= authority.resourceLimits.timeoutMs &&
    request.limits.memoryMb <= authority.resourceLimits.memoryMb &&
    request.limits.cpuSeconds <= authority.resourceLimits.cpuSeconds &&
    request.limits.outputMb <= authority.resourceLimits.outputMb &&
    isPositiveFinite(request.limits.timeoutMs);
  if (!withinLimits) return { admitted: false, code: 'INVALID_LIMITS' };
  if (!isSubset(request.environmentKeys, authority.allowedEnvironmentKeys)) return { admitted: false, code: 'INVALID_ENVIRONMENT_KEYS' };
  if (!isSubset(request.expectedArtifacts, authority.allowedArtifactKinds)) return { admitted: false, code: 'INVALID_ARTIFACT_REQUEST' };

  if (request.source) {
    if (
      request.source.type !== 'git' ||
      !/^https:\/\/[^/@?#\s]+(?:\/[^?#\s]*)?$/u.test(request.source.url) ||
      !SHA_PATTERN.test(request.source.revision) ||
      request.source.revision.toLowerCase() !== normalizedCurrent
    ) return { admitted: false, code: 'INVALID_SOURCE' };
    if (request.source.depth !== undefined && (!Number.isInteger(request.source.depth) || request.source.depth < 1 || request.source.depth > 100)) return { admitted: false, code: 'INVALID_SOURCE' };
  }

  const action = {
    actionId: 'platform:' + request.taskId + ':' + request.sessionId + ':' + normalizedCurrent.slice(0, 12),
    taskId: request.taskId,
    agentId: request.agentId,
    sessionId: request.sessionId,
    missionId: task.missionId,
    branch: task.allowedBranch,
    startSha: request.startSha,
    currentSha,
    operation: reason === 'READ_ONLY' ? 'READ' : 'TEST',
    path: authority.executionPath,
    objectiveId: authority.envelope.normalizedObjectiveId,
    acceptanceDigest: authority.envelope.acceptanceDigest,
    capability: task.capability,
    toolId: null,
    estimatedCost: 0,
    expectedDurationMs: request.limits.timeoutMs,
    delegationDepth: 0,
  } as const;

  const authorization = authorizeExecutionAction(authority.envelope, action, authority.usage);
  if (!authorization.allowed) {
    const finding = authorization.drift;
    if (finding?.type === 'D1_SCOPE_DRIFT') return { admitted: false, code: 'SCOPE_VIOLATION' };
    if (finding?.type === 'D2_OBJECTIVE_DRIFT') return { admitted: false, code: 'OBJECTIVE_DRIFT' };
    if (finding?.type === 'D3_TOOL_DRIFT') return { admitted: false, code: 'FORBIDDEN_ACTION' };
    if (finding?.type === 'D4_RESOURCE_DRIFT') return { admitted: false, code: 'RESOURCE_DRIFT' };
    if (finding?.type === 'D9_DELEGATION_DRIFT') return { admitted: false, code: 'DELEGATION_DRIFT' };
    return { admitted: false, code: 'INVALID_AUTHORITY_CONTEXT' };
  }
  return { admitted: true, reason };
}
