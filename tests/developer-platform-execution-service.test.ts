import assert from 'node:assert/strict';
import test from 'node:test';
import { executePlatformRequest } from '../src/lib/developer-platform/execution-service';
import type { ExecutionProvider } from '../src/lib/developer-platform/execution-provider';
import { DEFAULT_PROGRAMMING_LIMITS, type PlatformExecutionAuthorityContext, type PlatformExecutionRequest } from '../src/lib/developer-platform/platform-contract';

const SHA = '0123456789abcdef0123456789abcdef01234567';

const authority: PlatformExecutionAuthorityContext = {
  source: 'CANONICAL_CELL_RUNTIME',
  task: { taskId: 'EXEC-PLATFORM-EXECUTOR-001', status: 'IN_PROGRESS', agentId: 'agent', missionId: 'mission', allowedBranch: 'execution', sourceSha: SHA, capability: 'platform.execution.sandbox' },
  agentState: 'WORKING',
  envelope: {
    taskId: 'EXEC-PLATFORM-EXECUTOR-001', agentId: 'agent', sessionId: 'session', missionId: 'mission',
    startSha: SHA, allowedCapabilities: ['platform.execution.sandbox'], readScope: ['**'], writeScope: ['src/**'],
    allowedBranch: 'execution', forbiddenActions: [], expectedOutput: 'test', acceptanceConditions: ['test'],
    evidenceRequirements: ['exact-SHA'], timeBudgetMs: 600000, costBudget: 10, maxDelegationDepth: 0,
    normalizedObjectiveId: 'EXEC-PLATFORM-EXECUTOR-001', acceptanceDigest: 'a'.repeat(64), authority: 'IMPLEMENTER',
  },
  currentSha: SHA, executionPath: 'src/index.ts', cwdRoot: '/workspace', networkPolicy: { mode: 'NONE' },
  resourceLimits: { ...DEFAULT_PROGRAMMING_LIMITS, memoryMb: 4096, cpuSeconds: 900, outputMb: 128 },
  allowedEnvironmentKeys: [], allowedArtifactKinds: [], usage: { spentCost: 0, spentDurationMs: 0 },
};

const request: PlatformExecutionRequest = {
  projectId: 'demo', taskId: 'EXEC-PLATFORM-EXECUTOR-001', agentId: 'agent', sessionId: 'session',
  startSha: SHA, sourceSha: SHA, command: 'npm run test:hub', args: [], cwd: '/workspace',
  environmentKeys: [], network: { mode: 'NONE' }, limits: DEFAULT_PROGRAMMING_LIMITS, expectedArtifacts: [],
  source: { type: 'git', url: 'https://github.com/example/repo.git', revision: SHA },
};

const status = () => ({ id: 'fake', configured: true, capabilities: { ephemeralFilesystem: true, networkPolicy: true, resourceLimits: true, cancellation: true, artifactEvidence: true } });

test('execution service fails closed when no provider is configured', async () => {
  assert.deepEqual(await executePlatformRequest({ request, currentSha: SHA, authority, providers: [] }), {
    status: 'BLOCKED',
    code: 'NO_CONFIGURED_EXECUTION_PROVIDER',
  });
});

test('execution service never calls a provider on SHA drift', async () => {
  let called = false;
  const provider: ExecutionProvider = { id: 'fake', getStatus: status, execute: async () => { called = true; throw new Error('MUST_NOT_RUN'); }, cancel: async () => {} };
  const result = await executePlatformRequest({ request, currentSha: 'f'.repeat(40), authority, providers: [provider] });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(called, false);
});

test('execution service passes canonical authority to the configured provider', async () => {
  let seen = false;
  const provider: ExecutionProvider = {
    id: 'fake',
    getStatus: status,
    execute: async (_request, seenAuthority) => { seen = seenAuthority.source === 'CANONICAL_CELL_RUNTIME'; return { executionId: 'x', sourceSha: SHA, conclusion: 'PASS', exitCode: 0, stdout: 'ok', stderr: '', artifacts: [] }; },
    cancel: async () => {},
  };
  const result = await executePlatformRequest({ request, currentSha: SHA, authority, providers: [provider] });
  assert.equal(result.status, 'ADMITTED');
  assert.equal(seen, true);
});
