import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PROGRAMMING_LIMITS,
  evaluatePlatformExecution,
  type PlatformExecutionAuthorityContext,
  type PlatformExecutionRequest,
} from '../src/lib/developer-platform/platform-contract.ts';
import { PROGRAMMING_PLATFORM_CAPABILITIES } from '../src/lib/developer-platform/platform-registry';
import {
  DEFAULT_SANDBOX_POLICY,
  validateArtifactEvidence,
  validateContributionProposal,
  validateRepositoryMutation,
  type ContributionEvidenceIndex,
  type RepositoryAuthorityContext,
  type RepositorySnapshot,
} from '../src/lib/developer-platform/platform-boundaries';

const SHA = '0123456789abcdef0123456789abcdef01234567';

const authority = (): PlatformExecutionAuthorityContext => ({
  source: 'CANONICAL_CELL_RUNTIME',
  task: {
    taskId: 'EXEC-PLATFORM-CONTRACT-001',
    status: 'IN_PROGRESS',
    agentId: 'platform-test',
    missionId: 'mission-1',
    allowedBranch: 'execution',
    sourceSha: SHA,
    capability: 'platform.execution.sandbox',
  },
  agentState: 'WORKING',
  envelope: {
    taskId: 'EXEC-PLATFORM-CONTRACT-001',
    agentId: 'platform-test',
    sessionId: 'session-1',
    missionId: 'mission-1',
    startSha: SHA,
    allowedCapabilities: ['platform.execution.sandbox'],
    readScope: ['**'],
    writeScope: ['src/**'],
    allowedBranch: 'execution',
    forbiddenActions: [],
    expectedOutput: 'test-artifacts',
    acceptanceConditions: ['tests pass'],
    evidenceRequirements: ['exact-SHA evidence'],
    timeBudgetMs: 600000,
    costBudget: 10,
    maxDelegationDepth: 0,
    normalizedObjectiveId: 'EXEC-PLATFORM-CONTRACT-001',
    acceptanceDigest: 'a'.repeat(64),
    authority: 'IMPLEMENTER',
  },
  currentSha: SHA,
  executionPath: 'src/index.ts',
  cwdRoot: '/workspace',
  networkPolicy: { mode: 'NONE' },
  resourceLimits: { ...DEFAULT_PROGRAMMING_LIMITS, memoryMb: 4096, cpuSeconds: 900, outputMb: 128 },
  allowedEnvironmentKeys: ['CI'],
  allowedArtifactKinds: ['test-report.json'],
  usage: { spentCost: 0, spentDurationMs: 0 },
});

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

test('platform registry has unique capability ids and conservative current states', () => {
  assert.equal(new Set(PROGRAMMING_PLATFORM_CAPABILITIES.map((capability) => capability.id)).size, PROGRAMMING_PLATFORM_CAPABILITIES.length);
  assert.equal(PROGRAMMING_PLATFORM_CAPABILITIES.every((capability) => capability.authority.length > 0), true);
  assert.equal(PROGRAMMING_PLATFORM_CAPABILITIES.every((capability) => capability.state === 'FOUNDATION' || capability.state === 'BLOCKED'), true);
});

test('platform execution requires canonical authority and exact current source identity', () => {
  assert.deepEqual(evaluatePlatformExecution(baseRequest(), SHA, authority()), { admitted: true, reason: 'TARGETED_VERIFY' });
  assert.deepEqual(evaluatePlatformExecution(baseRequest(), 'fedcba9876543210fedcba9876543210fedcba98', authority()), {
    admitted: false,
    code: 'SHA_DRIFT',
  });
  assert.deepEqual(evaluatePlatformExecution(baseRequest(), SHA, null as never), {
    admitted: false,
    code: 'INVALID_AUTHORITY_CONTEXT',
  });
});

test('platform execution rejects parent traversal and invalid network hosts', () => {
  assert.equal(evaluatePlatformExecution({ ...baseRequest(), cwd: '/workspace/../secrets' }, SHA, authority()).admitted, false);
  assert.equal(
    evaluatePlatformExecution({ ...baseRequest(), network: { mode: 'ALLOWLIST' as const, hosts: ['https://example.com'] } }, SHA, authority()).admitted,
    false,
  );
});

test('platform execution rejects oversized resource requests', () => {
  const oversized = { ...baseRequest(), limits: { ...DEFAULT_PROGRAMMING_LIMITS, memoryMb: 8192 } };
  assert.deepEqual(evaluatePlatformExecution(oversized, SHA, authority()), { admitted: false, code: 'INVALID_LIMITS' });
});

test('platform execution rejects invalid environment keys and artifact kinds', () => {
  assert.equal(evaluatePlatformExecution({ ...baseRequest(), environmentKeys: ['token-value'] }, SHA, authority()).admitted, false);
  assert.equal(evaluatePlatformExecution({ ...baseRequest(), expectedArtifacts: ['UPPER CASE'] }, SHA, authority()).admitted, false);
});

test('repository mutations require exact head identity, task authority and no direct main mutation', () => {
  const snapshot: RepositorySnapshot = {
    provider: 'github',
    repository: 'm1m2m3m4m5m6m700-afk/FLIXO_Hub',
    defaultBranch: 'main',
    headSha: SHA,
    fetchedAt: '2026-10-08T00:00:00.000Z',
  };
  const a = authority();
  const repositoryAuthority: RepositoryAuthorityContext = {
    source: 'CANONICAL_CELL_RUNTIME',
    repository: snapshot.repository,
    task: { ...a.task!, capability: 'platform.repository.github' },
    envelope: { ...a.envelope, allowedCapabilities: ['platform.repository.github'] },
    currentSha: SHA,
    usage: { spentCost: 0, spentDurationMs: 0 },
  };
  const mutation = {
    kind: 'COMMIT' as const,
    repository: snapshot.repository,
    branch: 'execution',
    expectedHeadSha: SHA,
    taskId: 'EXEC-PLATFORM-CONTRACT-001',
    agentId: 'platform-test',
    message: 'feat: platform',
  };
  assert.equal(validateRepositoryMutation(mutation, snapshot, repositoryAuthority), true);
  assert.equal(validateRepositoryMutation({ ...mutation, branch: 'main' }, snapshot, repositoryAuthority), false);
  assert.equal(validateRepositoryMutation({ ...mutation, expectedHeadSha: 'f'.repeat(40) }, snapshot, repositoryAuthority), false);
});

test('artifact evidence and contribution proposals require resolved PASS evidence', () => {
  const verification = {
    verificationId: 'verify-1',
    sourceSha: SHA,
    checks: ['typecheck'],
    conclusion: 'PASS' as const,
  };
  const evidence = {
    artifactId: 'artifact-1',
    sourceSha: SHA,
    digest: 'a'.repeat(64),
    mediaType: 'application/json',
    verificationId: verification.verificationId,
  };
  const index: ContributionEvidenceIndex = { 'artifact-1': { evidence, verification } };
  const proposal = {
    proposalId: 'proposal-1',
    contributorId: 'contributor-1',
    kind: 'TOOL' as const,
    sourceSha: SHA,
    summary: 'A verified reusable developer capability.',
    evidenceIds: ['artifact-1'],
  };
  assert.equal(validateArtifactEvidence(evidence, verification), true);
  assert.equal(validateContributionProposal(proposal, SHA, index), true);
  assert.equal(validateContributionProposal(proposal, SHA, {}), false);
  assert.equal(validateContributionProposal(proposal, 'f'.repeat(40), index), false);
});

test('default sandbox policy is ephemeral, network-denied and resource bounded', () => {
  assert.equal(DEFAULT_SANDBOX_POLICY.filesystem, 'EPHEMERAL');
  assert.deepEqual(DEFAULT_SANDBOX_POLICY.network, { mode: 'NONE' });
  assert.equal(DEFAULT_SANDBOX_POLICY.secrets, 'BROKERED_KEYS_ONLY');
});
