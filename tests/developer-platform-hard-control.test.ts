import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PROGRAMMING_LIMITS,
  evaluatePlatformExecution,
  type PlatformExecutionAuthorityContext,
  type PlatformExecutionRequest,
} from '../src/lib/developer-platform/platform-contract.ts';
import {
  canTransitionContribution,
  transitionContribution,
  type ContributionEvidenceIndex,
  GovernedGitHubRepositoryProvider,
  type RepositoryAuthorityContext,
} from '../src/lib/developer-platform/platform-boundaries';

const SHA = '0123456789abcdef0123456789abcdef01234567';

function auth(overrides: Partial<PlatformExecutionAuthorityContext> = {}): PlatformExecutionAuthorityContext {
  const envelope = {
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
    evidenceRequirements: ['exact-SHA'],
    timeBudgetMs: 600000,
    costBudget: 10,
    maxDelegationDepth: 0,
    normalizedObjectiveId: 'EXEC-PLATFORM-CONTRACT-001',
    acceptanceDigest: 'a'.repeat(64),
    authority: 'IMPLEMENTER' as const,
  };
  return {
    source: 'CANONICAL_CELL_RUNTIME',
    task: {
      taskId: envelope.taskId,
      status: 'IN_PROGRESS',
      agentId: envelope.agentId,
      missionId: envelope.missionId,
      allowedBranch: envelope.allowedBranch,
      sourceSha: SHA,
      capability: 'platform.execution.sandbox',
    },
    agentState: 'WORKING',
    envelope,
    currentSha: SHA,
    executionPath: 'src/index.ts',
    cwdRoot: '/workspace',
    networkPolicy: { mode: 'NONE' },
    resourceLimits: { ...DEFAULT_PROGRAMMING_LIMITS, memoryMb: 4096, cpuSeconds: 900, outputMb: 128 },
    allowedEnvironmentKeys: ['CI'],
    allowedArtifactKinds: ['test-report.json'],
    usage: { spentCost: 0, spentDurationMs: 0 },
    ...overrides,
  };
}

function request(overrides: Partial<PlatformExecutionRequest> = {}): PlatformExecutionRequest {
  return {
    projectId: 'demo',
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
    ...overrides,
  };
}

test('missing, queued and non-working authority fail closed', () => {
  assert.equal(evaluatePlatformExecution(request(), SHA, null as never).admitted, false);
  assert.equal(evaluatePlatformExecution(request(), SHA, auth({ task: null })).code, 'INVALID_AUTHORITY_CONTEXT');
  assert.equal(evaluatePlatformExecution(request(), SHA, auth({ task: { ...auth().task!, status: 'QUEUED' } })).code, 'TASK_NOT_ADMITTED');
  assert.equal(evaluatePlatformExecution(request(), SHA, auth({ agentState: 'READY' })).code, 'AGENT_NOT_AUTHORIZED');
});

test('identity, branch and capability gates reject drift', () => {
  assert.equal(evaluatePlatformExecution(request({ agentId: 'other' }), SHA, auth()).code, 'INVALID_AGENT_ID');
  assert.equal(evaluatePlatformExecution(request({ sessionId: 'other' }), SHA, auth()).code, 'INVALID_SESSION_ID');
  assert.equal(evaluatePlatformExecution(request({ startSha: 'f'.repeat(40) }), SHA, auth()).code, 'SHA_DRIFT');
  assert.equal(evaluatePlatformExecution(request(), SHA, auth({ task: { ...auth().task!, allowedBranch: 'main' } })).code, 'BRANCH_NOT_ALLOWED');
  assert.equal(evaluatePlatformExecution(request(), SHA, auth({ envelope: { ...auth().envelope, allowedCapabilities: ['platform.repository.github'] } })).code, 'CAPABILITY_NOT_ALLOWED');
});

test('heuristic command classification is gone and shell escape syntax is rejected', () => {
  assert.equal(evaluatePlatformExecution(request({ command: 'node -e', args: ['process.exit(0)'] }), SHA, auth()).code, 'COMMAND_NOT_ALLOWLISTED');
  assert.equal(evaluatePlatformExecution(request({ command: 'npm test && rm -rf /', args: [] }), SHA, auth()).code, 'COMMAND_NOT_ALLOWLISTED');
  assert.equal(evaluatePlatformExecution(request({ command: 'bash', args: ['-c', 'id'] }), SHA, auth()).code, 'COMMAND_NOT_ALLOWLISTED');
  assert.deepEqual(evaluatePlatformExecution(request({ command: 'npm run test:hub', args: [] }), SHA, auth()), {
    admitted: true,
    reason: 'TARGETED_VERIFY',
  });
});

test('network, scope, resource and forbidden-action gates are hard failures', () => {
  assert.equal(evaluatePlatformExecution(request({ network: { mode: 'ALLOWLIST', hosts: ['example.com'] } }), SHA, auth()).code, 'INVALID_NETWORK_POLICY');
  assert.equal(evaluatePlatformExecution(request({ limits: { ...DEFAULT_PROGRAMMING_LIMITS, memoryMb: 4097 } }), SHA, auth()).code, 'RESOURCE_DRIFT');
  assert.equal(evaluatePlatformExecution(request(), SHA, auth({ executionPath: 'secrets.txt', envelope: { ...auth().envelope, readScope: ['src/**'] } })).code, 'SCOPE_VIOLATION');
  assert.equal(evaluatePlatformExecution(request(), SHA, auth({ envelope: { ...auth().envelope, forbiddenActions: ['TEST'] } })).code, 'FORBIDDEN_ACTION');
});

test('contribution publication is evidence-resolved and source-fresh', () => {
  const verification = { verificationId: 'verify-1', sourceSha: SHA, checks: ['typecheck'], conclusion: 'PASS' as const };
  const index: ContributionEvidenceIndex = {
    evidence: {
      evidence: { artifactId: 'artifact-1', sourceSha: SHA, digest: 'a'.repeat(64), mediaType: 'application/json', verificationId: 'verify-1' },
      verification,
    },
  };
  const proposal = {
    proposalId: 'proposal-1',
    contributorId: 'contributor-1',
    kind: 'TOOL' as const,
    sourceSha: SHA,
    summary: 'A verified reusable developer capability.',
    evidenceIds: ['evidence'],
  };
  assert.equal(canTransitionContribution('PROPOSED', 'UNDER_REVIEW', proposal, SHA, index), true);
  assert.equal(canTransitionContribution('UNDER_REVIEW', 'VERIFIED', proposal, SHA, index), true);
  assert.equal(transitionContribution('VERIFIED', 'PUBLISHED', proposal, SHA, index), 'PUBLISHED');
  assert.equal(canTransitionContribution('UNDER_REVIEW', 'PUBLISHED', proposal, SHA, index), false);
  assert.equal(canTransitionContribution('UNDER_REVIEW', 'VERIFIED', proposal, 'f'.repeat(40), index), false);
});

test('governed GitHub provider blocks stale mutations before transport mutation', async () => {
  const a = auth();
  const repository = 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';
  const authority: RepositoryAuthorityContext = {
    source: 'CANONICAL_CELL_RUNTIME',
    repository,
    task: { ...a.task!, capability: 'platform.repository.github' },
    envelope: { ...a.envelope, allowedCapabilities: ['platform.repository.github'] },
    currentSha: SHA,
    usage: { spentCost: 0, spentDurationMs: 0 },
  };
  const snapshot = {
    provider: 'github' as const,
    repository,
    defaultBranch: 'main',
    headSha: SHA,
    fetchedAt: '2026-10-08T00:00:00.000Z',
  };
  let mutationCalls = 0;
  const provider = new GovernedGitHubRepositoryProvider(
    {
      async getSnapshot() {
        return { defaultBranch: snapshot.defaultBranch, headSha: snapshot.headSha };
      },
      async proposeMutation() {
        mutationCalls += 1;
        return { proposalId: 'proposal-1' };
      },
    },
    authority,
  );
  const mutation = {
    kind: 'COMMIT' as const,
    repository,
    branch: 'execution',
    expectedHeadSha: SHA,
    taskId: 'EXEC-PLATFORM-CONTRACT-001',
    agentId: 'platform-test',
    message: 'feat: governed platform',
  };
  assert.deepEqual(await provider.proposeMutation(mutation), { proposalId: 'proposal-1' });
  assert.equal(mutationCalls, 1);
  await assert.rejects(
    provider.proposeMutation({ ...mutation, expectedHeadSha: 'f'.repeat(40) }),
    /REPOSITORY_MUTATION_DENIED/,
  );
  assert.equal(mutationCalls, 1);
});
