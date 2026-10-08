import assert from 'node:assert/strict';
import test from 'node:test';
import { executePlatformRequest } from '../src/lib/developer-platform/execution-service';
import type { ExecutionProvider } from '../src/lib/developer-platform/execution-provider';
import { DEFAULT_PROGRAMMING_LIMITS, type PlatformExecutionRequest } from '../src/lib/developer-platform/platform-contract';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const request: PlatformExecutionRequest = {
  projectId: 'demo', taskId: 'EXEC-PLATFORM-EXECUTOR-001', agentId: 'agent', sessionId: 'session',
  startSha: SHA, sourceSha: SHA, command: 'node', args: ['-e', 'console.log(1)'], cwd: '/workspace',
  environmentKeys: [], network: { mode: 'NONE' }, limits: { ...DEFAULT_PROGRAMMING_LIMITS, memoryMb: 2048 },
  expectedArtifacts: [], source: { type: 'git', url: 'https://github.com/example/repo.git', revision: SHA },
};

test('execution service fails closed when no provider is configured', async () => {
  const result = await executePlatformRequest({ request, currentSha: SHA, providers: [] });
  assert.deepEqual(result, { status: 'BLOCKED', code: 'NO_CONFIGURED_EXECUTION_PROVIDER' });
});

test('execution service never runs on SHA drift', async () => {
  let called = false;
  const provider: ExecutionProvider = {
    id: 'fake',
    getStatus: () => ({ id: 'fake', configured: true, capabilities: { ephemeralFilesystem: true, networkPolicy: true, resourceLimits: true, cancellation: true, artifactEvidence: true } }),
    execute: async () => { called = true; throw new Error('MUST_NOT_RUN'); },
    cancel: async () => {},
  };
  const result = await executePlatformRequest({ request, currentSha: 'fedcba9876543210fedcba9876543210fedcba98', providers: [provider] });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(called, false);
});

test('execution service returns provider result only when source identity survives execution', async () => {
  const provider: ExecutionProvider = {
    id: 'fake',
    getStatus: () => ({ id: 'fake', configured: true, capabilities: { ephemeralFilesystem: true, networkPolicy: true, resourceLimits: true, cancellation: true, artifactEvidence: true } }),
    execute: async (input) => ({ executionId: 'x', sourceSha: input.sourceSha, conclusion: 'PASS', exitCode: 0, stdout: 'ok', stderr: '', artifacts: [] }),
    cancel: async () => {},
  };
  const result = await executePlatformRequest({ request, currentSha: SHA, providers: [provider] });
  assert.equal(result.status, 'ADMITTED');
  if (result.status === 'ADMITTED') assert.equal(result.providerId, 'fake');
});