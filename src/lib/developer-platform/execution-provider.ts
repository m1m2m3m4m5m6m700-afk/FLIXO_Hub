import type { PlatformExecutionRequest, ResourceLimits } from './platform-contract';

export type ProviderStatus = Readonly<{
  id: string;
  configured: boolean;
  capabilities: Readonly<{
    ephemeralFilesystem: boolean;
    networkPolicy: boolean;
    resourceLimits: boolean;
    cancellation: boolean;
    artifactEvidence: boolean;
  }>;
  blockedReason?: string;
}>;

export type ExecutionArtifact = Readonly<{
  artifactId: string;
  sourceSha: string;
  digest: string;
  mediaType: string;
  sizeBytes: number;
}>;

export type ExecutionResult = Readonly<{
  executionId: string;
  sourceSha: string;
  conclusion: 'PASS' | 'FAIL' | 'CANCELLED' | 'ERROR';
  exitCode: number | null;
  stdout: string;
  stderr: string;
  artifacts: readonly ExecutionArtifact[];
}>;

export interface ExecutionProvider {
  readonly id: string;
  getStatus(): ProviderStatus;
  execute(request: PlatformExecutionRequest): Promise<ExecutionResult>;
  cancel(executionId: string): Promise<void>;
}

export type ExecutionProviderRegistry = Readonly<{
  providers: readonly ExecutionProvider[];
}>;

export function chooseExecutionProvider(
  registry: ExecutionProviderRegistry,
  requestedId?: string,
): ExecutionProvider | null {
  if (requestedId) {
    const provider = registry.providers.find((candidate) => candidate.id === requestedId);
    return provider ?? null;
  }

  return registry.providers.find((candidate) => candidate.getStatus().configured) ?? null;
}

export function assertProviderResourceCompatibility(
  limits: ResourceLimits,
  constraints: Readonly<{ minMemoryMb: number; memoryStepMb: number; maxTimeoutMs: number }>,
): void {
  if (limits.memoryMb < constraints.minMemoryMb || limits.memoryMb % constraints.memoryStepMb !== 0) {
    throw new Error('UNSUPPORTED_RESOURCE_LIMITS');
  }
  if (limits.timeoutMs > constraints.maxTimeoutMs) {
    throw new Error('UNSUPPORTED_TIMEOUT_LIMIT');
  }
}
