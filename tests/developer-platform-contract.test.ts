import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PROGRAMMING_LIMITS,
  evaluatePlatformExecution,
  type PlatformExecutionRequest,
} from '../src/lib/developer-platform/platform-contract.ts';
import { PROGRAMMING_PLATFORM_CAPABILITIES } from '../src/lib/developer-platform/platform-registry.ts';

const SHA = '0123456789abcdef0123456789abcdef01234567';

const baseRequest = (): PlatformExecutionRequest => ({
  projectId: 'demo-project',
  taskId: 'EXEC-PLATFORM-CONTRACT-001',
  agentId: 'platform-test',
  sessionId: 'session-1',
  startSha: SHA,
  sourceSha: SHA,
  command: 'npm test',
  args: ['--', '--runInBand'],
  cwd: '/workspace',
  environmentKeys: ['CI'],
  network: { mode: 'NONE' },
  limits: DEFAULT_PROGRAMMING_LIMITS,
  expectedArtifacts: ['test-report.json'],
});

test('platform registry has unique capability ids and no unknown state', () => {
  assert.equal(new Set(PROGRAMMING_PLATFORM_CAPABILITIES.map((capability) => capability.id)).size, PROGRAMMING_PLATFORM_CAPABILITIES.length);
  assert.equal(PROGRAMMING_PLATFORM_CAPABILITIES.every((capability) => capability.authority.length > 0), true);
});

test('platform execution requires exact current source identity', () => {
  assert.deepEqual(evaluatePlatformExecution(baseRequest(), SHA), { admitted: true, reason: 'TARGETED_VERIFY' });
  assert.deepEqual(evaluatePlatformExecution(baseRequest(), 'fedcba9876543210fedcba9876543210fedcba98'), {
    admitted: false,
    code: 'SHA_DRIFT',
  });
});

test('platform execution rejects parent traversal and invalid network hosts', () => {
  const parentTraversal = { ...baseRequest(), cwd: '/workspace/../secrets' };
  const badNetwork = { ...baseRequest(), network: { mode: 'ALLOWLIST' as const, hosts: ['https://example.com'] } };
  assert.equal(evaluatePlatformExecution(parentTraversal, SHA).admitted, false);
  assert.equal(evaluatePlatformExecution(badNetwork, SHA).admitted, false);
});

test('platform execution rejects oversized resource requests', () => {
  const oversized = {
    ...baseRequest(),
    limits: { ...DEFAULT_PROGRAMMING_LIMITS, memoryMb: 8192 },
  };
  assert.deepEqual(evaluatePlatformExecution(oversized, SHA), {
    admitted: false,
    code: 'INVALID_LIMITS',
  });
});

test('platform execution rejects invalid environment keys and artifact kinds', () => {
  assert.equal(evaluatePlatformExecution({ ...baseRequest(), environmentKeys: ['token-value'] }, SHA).admitted, false);
  assert.equal(evaluatePlatformExecution({ ...baseRequest(), expectedArtifacts: ['UPPER CASE'] }, SHA).admitted, false);
});
