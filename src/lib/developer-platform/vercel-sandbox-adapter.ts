import { createHash } from 'node:crypto';
import {
  assertProviderResourceCompatibility,
  type ExecutionArtifact,
  type ExecutionProvider,
  type ExecutionResult,
  type ProviderStatus,
} from './execution-provider';
import { evaluatePlatformExecution, type PlatformExecutionAuthorityContext, type PlatformExecutionRequest } from './platform-contract';

export type VercelSandboxCommandResult = Readonly<{
  exitCode: number;
  stdout(): Promise<string>;
  stderr(): Promise<string>;
}>;

export type VercelSandboxSession = {
  runCommand(input: Readonly<{
    cmd: string;
    args: readonly string[];
    cwd: string;
    timeout: number;
    env?: Readonly<Record<string, string>>;
  }>): Promise<VercelSandboxCommandResult>;
  stop(): Promise<unknown>;
};

export type VercelNetworkPolicy =
  | Readonly<{ mode: 'deny-all' }>
  | Readonly<{ mode: 'custom'; allowedDomains: readonly string[] }>;

export type VercelSandboxClient = Readonly<{
  create(input: Readonly<{
    name: string;
    persistent: false;
    timeout: number;
    networkPolicy: VercelNetworkPolicy;
    resources: Readonly<{ vcpus: number; memory: number }>;
    source: NonNullable<PlatformExecutionRequest['source']>;
  }>): Promise<VercelSandboxSession>;
}>;

function mapNetworkPolicy(request: PlatformExecutionRequest): VercelNetworkPolicy {
  if (request.network.mode === 'NONE') return { mode: 'deny-all' };
  return { mode: 'custom', allowedDomains: request.network.hosts };
}

type ActiveExecution = Readonly<{
  executionId: string;
  sandbox: VercelSandboxSession;
}>;

export class VercelSandboxExecutionProvider implements ExecutionProvider {
  readonly id = 'vercel-sandbox';
  private readonly active = new Map<string, ActiveExecution>();
  private readonly client: VercelSandboxClient | null;

  constructor(client: VercelSandboxClient | null) {
    this.client = client;
  }

  getStatus(): ProviderStatus {
    if (!this.client) {
      return {
        id: this.id,
        configured: false,
        blockedReason: 'VERCEL_SANDBOX_CLIENT_NOT_CONFIGURED',
        capabilities: {
          ephemeralFilesystem: true,
          networkPolicy: true,
          resourceLimits: true,
          cancellation: true,
          artifactEvidence: true,
        },
      };
    }

    return {
      id: this.id,
      configured: true,
      capabilities: {
        ephemeralFilesystem: true,
        networkPolicy: true,
        resourceLimits: true,
        cancellation: true,
        artifactEvidence: true,
      },
    };
  }

  async execute(request: PlatformExecutionRequest, authority: PlatformExecutionAuthorityContext): Promise<ExecutionResult> {
    const decision = evaluatePlatformExecution(request, authority.currentSha, authority);
    if (!decision.admitted) throw new Error('PLATFORM_EXECUTION_DENIED:' + decision.code);
    if (!this.client) throw new Error('VERCEL_SANDBOX_CLIENT_NOT_CONFIGURED');

    const providerMemoryMb = request.limits.memoryMb;
    assertProviderResourceCompatibility(request.limits, {
      minMemoryMb: 2048,
      memoryStepMb: 2048,
      maxTimeoutMs: 5 * 60 * 60 * 1000,
    });

    const vcpus = request.limits.memoryMb / 2048;
    if (vcpus !== 1 && vcpus % 2 !== 0) {
      throw new Error('UNSUPPORTED_VERCEL_CPU_MEMORY_PAIR');
    }

    if (!request.source) {
      throw new Error('VERCEL_SANDBOX_SOURCE_REQUIRED');
    }
    if (request.source.revision !== request.sourceSha) {
      throw new Error('VERCEL_SANDBOX_SOURCE_SHA_MISMATCH');
    }

    const executionId = [
      'vercel',
      request.taskId,
      request.sessionId,
      request.source.revision.slice(0, 12),
    ].join(':');

    const sandbox = await this.client.create({
      name: executionId.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 120),
      persistent: false,
      timeout: request.limits.timeoutMs,
      networkPolicy: mapNetworkPolicy(request),
      resources: {
        vcpus,
        memory: providerMemoryMb,
      },
      source: request.source,
    });

    this.active.set(executionId, { executionId, sandbox });

    try {
      const result = await sandbox.runCommand({
        cmd: request.command,
        args: request.args,
        cwd: request.cwd,
        timeout: request.limits.timeoutMs,
      });

      const [stdout, stderr] = await Promise.all([result.stdout(), result.stderr()]);
      const totalOutputBytes = Buffer.byteLength(stdout) + Buffer.byteLength(stderr);
      if (totalOutputBytes > request.limits.outputMb * 1024 * 1024) {
        return {
          executionId,
          sourceSha: request.sourceSha,
          conclusion: 'FAIL',
          exitCode: result.exitCode,
          stdout: '',
          stderr: 'OUTPUT_LIMIT_EXCEEDED',
          artifacts: [],
        };
      }
      const artifacts: ExecutionArtifact[] = [];
      if (stdout.length > 0) {
        const digest = createHash('sha256').update(stdout).digest('hex');
        artifacts.push({
          artifactId: `${executionId}:stdout`,
          sourceSha: request.sourceSha,
          digest,
          mediaType: 'text/plain',
          sizeBytes: Buffer.byteLength(stdout),
        });
      }
      if (stderr.length > 0) {
        const digest = createHash('sha256').update(stderr).digest('hex');
        artifacts.push({
          artifactId: `${executionId}:stderr`,
          sourceSha: request.sourceSha,
          digest,
          mediaType: 'text/plain',
          sizeBytes: Buffer.byteLength(stderr),
        });
      }

      return {
        executionId,
        sourceSha: request.sourceSha,
        conclusion: result.exitCode === 0 ? 'PASS' : 'FAIL',
        exitCode: result.exitCode,
        stdout,
        stderr,
        artifacts,
      };
    } finally {
      this.active.delete(executionId);
      await sandbox.stop();
    }
  }

  async cancel(executionId: string): Promise<void> {
    const active = this.active.get(executionId);
    if (!active) return;
    this.active.delete(executionId);
    await active.sandbox.stop();
  }
}
