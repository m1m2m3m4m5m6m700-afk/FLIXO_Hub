import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PROGRAMMING_LIMITS,
  evaluatePlatformExecution,
  type PlatformExecutionRequest,
} from '../src/lib/developer-platform/platform-contract.ts';
import { PROGRAMMING_PLATFORM_CAPABILITIES } from '../src/lib/developer-platform/platform-registry';
import {
  DEFAULT_SANDBOX_POLICY,
  validateArtifactEvidence,
  validateContributionProposal,
  validateRepositoryMutation,
  type RepositorySnapshot,
} from '../src/lib/developer-platform/platform-boundaries';

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

test('platform registry has unique capability ids and no unknown authority metadata', () => {
  assert.equal(
    new Set(PROGRAMMING_PLATFORM_CAPABILITIES.map((capability) => capability.id)).size,
    PROGRAMMING_PLATFORM_CAPABILITIES.length,
  );
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
  const oversized = { ...baseRequest(), limits: { ...DEFAULT_PROGRAMMING_LIMITS, memoryMb: 8192 } };
  assert.deepEqual(evaluatePlatformExecution(oversized, SHA), {
    admitted: false,
    code: 'INVALID_LIMITS',
  });
});

test('platform execution rejects invalid environment keys and artifact kinds', () => {
  assert.equal(evaluatePlatformExecution({ ...baseRequest(), environmentKeys: ['token-value'] }, SHA).admitted, false);
  assert.equal(evaluatePlatformExecution({ ...baseRequest(), expectedArtifacts: ['UPPER CASE'] }, SHA).admitted, false);
});

test('repository mutations require exact head identity and never target main directly', () => {
  const snapshot: RepositorySnapshot = {
    provider: 'github',
    repository: 'm1m2m3m4m5m6m700-afk/FLIXO_Hub',
    defaultBranch: 'main',
    headSha: SHA,
    fetchedAt: '2026-10-08T00:00:00Z',
  };
  assert.equal(
    validateRepositoryMutation(
      {
        kind: 'COMMIT',
        repository: snapshot.repository,
        branch: 'execution',
        expectedHeadSha: SHA,
        taskId: 'EXEC-PLATFORM-CONTRACT-001',
        agentId: 'platform-test',
        message: 'feat: platform',
      },
      snapshot,
    ),
    true,
  );
  assert.equal(
    validateRepositoryMutation(
      {
        kind: 'COMMIT',
        repository: snapshot.repository,
        branch: 'main',
        expectedHeadSha: SHA,
        taskId: 'EXEC-PLATFORM-CONTRACT-001',
        agentId: 'platform-test',
        message: 'feat: platform',
      },
      snapshot,
    ),
    false,
  );
});

test('artifact evidence and contribution proposals require fresh proof', () => {
  const verification = {
    verificationId: 'verify-1',
    sourceSha: SHA,
    checks: ['typecheck'],
    conclusion: 'PASS' as const,
  };
  assert.equal(
    validateArtifactEvidence(
      {
        artifactId: 'artifact-1',
        sourceSha: SHA,
        digest: 'a'.repeat(64),
        mediaType: 'application/json',
        verificationId: verification.verificationId,
      },
      verification,
    ),
    true,
  );
  assert.equal(
    validateContributionProposal(
      {
        proposalId: 'proposal-1',
        contributorId: 'contributor-1',
        kind: 'TOOL',
        sourceSha: SHA,
        summary: 'A verified reusable developer capability.',
        evidenceIds: ['artifact-1'],
      },
      SHA,
    ),
    true,
  );
  assert.equal(
    validateContributionProposal(
      {
        proposalId: 'proposal-2',
        contributorId: 'contributor-1',
        kind: 'TOOL',
        sourceSha: 'f'.repeat(40),
        summary: 'A verified reusable developer capability.',
        evidenceIds: ['artifact-1'],
      },
      SHA,
    ),
    false,
  );
});

test('default sandbox policy is ephemeral, network-denied and resource bounded', () => {
  assert.equal(DEFAULT_SANDBOX_POLICY.filesystem, 'EPHEMERAL');
  assert.deepEqual(DEFAULT_SANDBOX_POLICY.network, { mode: 'NONE' });
  assert.equal(DEFAULT_SANDBOX_POLICY.secrets, 'BROKERED_KEYS_ONLY');
});

test('contribution proposal rejects malformed source SHAs', () => {
  assert.equal(validateContributionProposal({
    proposalId: 'proposal-3',
    contributorId: 'contributor-1',
    kind: 'TOOL',
    sourceSha: 'not-a-sha',
    summary: 'A verified reusable developer capability.',
    evidenceIds: ['artifact-1'],
  }, 'not-a-sha'), false);
});
