import assert from 'node:assert/strict';
import test from 'node:test';
import { assertProviderResourceCompatibility } from '../src/lib/developer-platform/execution-provider';
import { VercelSandboxExecutionProvider, type VercelSandboxClient } from '../src/lib/developer-platform/vercel-sandbox-adapter';
import { DEFAULT_PROGRAMMING_LIMITS, type PlatformExecutionAuthorityContext, type PlatformExecutionRequest } from '../src/lib/developer-platform/platform-contract';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const authority: PlatformExecutionAuthorityContext = {
  source: 'CANONICAL_CELL_RUNTIME',
  task: { taskId: 'EXEC-PLATFORM-EXECUTOR-001', status: 'IN_PROGRESS', agentId: 'platform-test', missionId: 'mission-1', allowedBranch: 'execution', sourceSha: SHA, capability: 'platform.execution.sandbox' },
  agentState: 'WORKING',
  envelope: {
    taskId: 'EXEC-PLATFORM-EXECUTOR-001', agentId: 'platform-test', sessionId: 'session-vercel', missionId: 'mission-1',
    startSha: SHA, allowedCapabilities: ['platform.execution.sandbox'], readScope: ['**'], writeScope: ['src/**'],
    allowedBranch: 'execution', forbiddenActions: [], expectedOutput: 'sandbox-test', acceptanceConditions: ['test'],
    evidenceRequirements: ['exact-SHA'], timeBudgetMs: 600000, costBudget: 10, maxDelegationDepth: 0,
    normalizedObjectiveId: 'EXEC-PLATFORM-EXECUTOR-001', acceptanceDigest: 'b'.repeat(64), authority: 'IMPLEMENTER',
  },
  currentSha: SHA, executionPath: 'src/index.ts', cwdRoot: '/vercel/sandbox', networkPolicy: { mode: 'NONE' },
  resourceLimits: { ...DEFAULT_PROGRAMMING_LIMITS, memoryMb: 4096, cpuSeconds: 900, outputMb: 128 },
  allowedEnvironmentKeys: [], allowedArtifactKinds: ['stdout'], usage: { spentCost: 0, spentDurationMs: 0 },
};

const request = (): PlatformExecutionRequest => ({
  projectId: 'demo-project', taskId: 'EXEC-PLATFORM-EXECUTOR-001', agentId: 'platform-test', sessionId: 'session-vercel',
  startSha: SHA, sourceSha: SHA, command: 'npm run test:hub', args: [], cwd: '/vercel/sandbox', environmentKeys: [],
  network: { mode: 'NONE' }, limits: { ...DEFAULT_PROGRAMMING_LIMITS, memoryMb: 2048 }, expectedArtifacts: ['stdout'],
  source: { type: 'git', url: 'https://github.com/example/repo.git', revision: SHA, depth: 1 },
});

test('Vercel Sandbox provider remains explicitly unconfigured without a client', () => {
  const provider = new VercelSandboxExecutionProvider(null);
  assert.equal(provider.getStatus().configured, false);
});

test('provider rejects limits it cannot enforce exactly', () => {
  assert.throws(() => assertProviderResourceCompatibility({ ...DEFAULT_PROGRAMMING_LIMITS, memoryMb: 1024 }, {
    minMemoryMb: 2048, memoryStepMb: 2048, maxTimeoutMs: 5 * 60 * 60 * 1000,
  }), /UNSUPPORTED_RESOURCE_LIMITS/);
});

test('provider denies unsafe requests before sandbox creation', async () => {
  const provider = new VercelSandboxExecutionProvider({ async create() { throw new Error('CREATE_MUST_NOT_RUN'); } });
  await assert.rejects(
    provider.execute({ ...request(), command: 'bash', args: ['-c', 'id'] }, authority),
    /PLATFORM_EXECUTION_DENIED:COMMAND_NOT_ALLOWLISTED/,
  );
});

test('fake sandbox proves exact source and cleanup behavior through the governed adapter', async () => {
  let stopped = false;
  let observed: { source?: unknown; command?: string; args?: readonly string[]; networkPolicy?: unknown } = {};
  const client: VercelSandboxClient = {
    async create(input) {
      observed = { source: input.source, command: undefined, args: undefined, networkPolicy: input.networkPolicy };
      return {
        async runCommand(input) {
          observed.command = input.cmd;
          observed.args = input.args;
          return { exitCode: 0, async stdout() { return 'ok'; }, async stderr() { return ''; } };
        },
        async stop() { stopped = true; },
      };
    },
  };
  const result = await new VercelSandboxExecutionProvider(client).execute(request(), authority);
  assert.equal(result.conclusion, 'PASS');
  assert.equal(result.sourceSha, SHA);
  assert.equal(result.artifacts.length, 1);
  assert.equal(observed.command, 'npm run test:hub');
  assert.deepEqual(observed.args, []);
  assert.deepEqual(observed.networkPolicy, { mode: 'deny-all' });
  assert.equal(stopped, true);
});
