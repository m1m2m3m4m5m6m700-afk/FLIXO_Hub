import {
  authorizeExecutionAction,
  type BudgetUsage,
  type ExecutionEnvelope,
} from '../../../packages/contracts/src/cell-hard-control.ts';
import type {
  NetworkPolicy,
  PlatformExecutionAuthorityContext,
  PlatformExecutionRequest,
  PlatformTaskAuthorityProjection,
  ProgrammingProjectManifest,
  ResourceLimits,
} from './platform-contract';

export type WorkspaceState = Readonly<{
  project: ProgrammingProjectManifest;
  filesRoot: string;
  revisionSha: string;
  dirty: boolean;
}>;

export type RepositorySnapshot = Readonly<{
  provider: 'github';
  repository: string;
  defaultBranch: string;
  headSha: string;
  fetchedAt: string;
}>;

export type RepositoryMutation =
  | Readonly<{ kind: 'COMMIT'; repository: string; branch: string; expectedHeadSha: string; taskId: string; agentId: string; message: string; }>
  | Readonly<{ kind: 'PULL_REQUEST'; repository: string; base: string; head: string; expectedHeadSha: string; taskId: string; agentId: string; }>;

export type VerificationRun = Readonly<{
  verificationId: string;
  sourceSha: string;
  checks: readonly string[];
  conclusion: 'PASS' | 'FAIL' | 'BLOCKED';
  externalEvidenceUrl?: string;
}>;

export type ArtifactEvidence = Readonly<{
  artifactId: string;
  sourceSha: string;
  digest: string;
  mediaType: string;
  verificationId: string;
}>;

export type ContributionProposal = Readonly<{
  proposalId: string;
  contributorId: string;
  kind: 'PROJECT_TEMPLATE' | 'TOOL' | 'AGENT' | 'SKILL' | 'VERIFIER' | 'RUNTIME_ADAPTER' | 'DOCS' | 'WORKFLOW';
  sourceSha: string;
  summary: string;
  evidenceIds: readonly string[];
}>;

export type RepositoryAuthorityContext = Readonly<{
  source: 'CANONICAL_CELL_RUNTIME';
  repository: string;
  task: PlatformTaskAuthorityProjection | null;
  envelope: ExecutionEnvelope;
  currentSha: string;
  usage: BudgetUsage;
}>;

export interface PlatformExecutionProvider {
  readonly id: string;
  readonly supportsNetworkPolicy: boolean;
  readonly supportsResourceLimits: boolean;
  readonly supportsCancellation: boolean;
  execute(request: PlatformExecutionRequest, authority: PlatformExecutionAuthorityContext): Promise<{
    executionId: string;
    sourceSha: string;
    conclusion: 'PASS' | 'FAIL' | 'CANCELLED' | 'ERROR';
    artifactIds: readonly string[];
  }>;
  cancel(executionId: string): Promise<void>;
}

export interface RepositoryProvider {
  readonly id: 'github';
  getSnapshot(repository: string, branch: string): Promise<RepositorySnapshot>;
  proposeMutation(mutation: RepositoryMutation): Promise<{ proposalId: string }>;
}

function authorizeRepositoryAction(
  mutation: RepositoryMutation,
  snapshot: RepositorySnapshot,
  authority: RepositoryAuthorityContext,
): boolean {
  if (
    authority.source !== 'CANONICAL_CELL_RUNTIME' ||
    !authority.task ||
    authority.repository !== snapshot.repository ||
    mutation.repository !== authority.repository ||
    authority.currentSha !== snapshot.headSha ||
    authority.task.sourceSha !== snapshot.headSha ||
    authority.task.taskId !== mutation.taskId ||
    authority.task.agentId !== mutation.agentId ||
    authority.task.status === 'QUEUED' ||
    authority.envelope.taskId !== mutation.taskId ||
    authority.envelope.agentId !== mutation.agentId ||
    authority.envelope.startSha !== snapshot.headSha ||
    authority.envelope.allowedBranch === 'main'
  ) return false;

  const branch = mutation.kind === 'COMMIT' ? mutation.branch : mutation.head;
  if (branch !== authority.task.allowedBranch || branch !== authority.envelope.allowedBranch) return false;
  if (mutation.expectedHeadSha !== snapshot.headSha) return false;

  const action = {
    actionId: 'repository:' + mutation.kind + ':' + mutation.taskId + ':' + mutation.expectedHeadSha.slice(0, 12),
    taskId: mutation.taskId,
    agentId: mutation.agentId,
    sessionId: authority.envelope.sessionId,
    missionId: authority.envelope.missionId,
    branch,
    startSha: authority.envelope.startSha,
    currentSha: authority.currentSha,
    operation: mutation.kind === 'COMMIT' ? 'COMMIT' : 'BRANCH',
    path: null,
    objectiveId: authority.envelope.normalizedObjectiveId,
    acceptanceDigest: authority.envelope.acceptanceDigest,
    capability: authority.task.capability,
    toolId: 'github',
    estimatedCost: 0,
    expectedDurationMs: 1000,
    delegationDepth: 0,
  } as const;
  return authorizeExecutionAction(authority.envelope, action, authority.usage).allowed;
}

export function validateRepositoryMutation(
  mutation: RepositoryMutation,
  snapshot: RepositorySnapshot,
  authority: RepositoryAuthorityContext,
): boolean {
  if (!/^[0-9a-f]{40}$/i.test(snapshot.headSha) || snapshot.provider !== 'github') return false;
  if (mutation.kind === 'COMMIT') {
    if (mutation.branch === 'main' || !mutation.message.trim()) return false;
  } else if (mutation.base !== 'main' || mutation.head === 'main') {
    return false;
  }
  return authorizeRepositoryAction(mutation, snapshot, authority);
}

export type RepositoryTransport = Readonly<{
  getSnapshot(repository: string, branch: string): Promise<Readonly<{ defaultBranch: string; headSha: string }>>;
  proposeMutation(mutation: RepositoryMutation): Promise<{ proposalId: string }>;
}>;

export class GovernedGitHubRepositoryProvider implements RepositoryProvider {
  readonly id = 'github' as const;

  constructor(
    private readonly transport: RepositoryTransport,
    private readonly authority: RepositoryAuthorityContext,
  ) {}

  async getSnapshot(repository: string, branch: string): Promise<RepositorySnapshot> {
    const remote = await this.transport.getSnapshot(repository, branch);
    if (!/^[0-9a-f]{40}$/i.test(remote.headSha)) throw new Error('INVALID_REMOTE_HEAD_SHA');
    return Object.freeze({
      provider: 'github',
      repository,
      defaultBranch: remote.defaultBranch,
      headSha: remote.headSha,
      fetchedAt: new Date().toISOString(),
    });
  }

  async proposeMutation(mutation: RepositoryMutation): Promise<{ proposalId: string }> {
    const branch = mutation.kind === 'COMMIT' ? mutation.branch : mutation.head;
    const snapshot = await this.getSnapshot(mutation.repository, branch);
    if (!validateRepositoryMutation(mutation, snapshot, this.authority)) throw new Error('REPOSITORY_MUTATION_DENIED');
    return this.transport.proposeMutation(mutation);
  }
}

export function validateArtifactEvidence(evidence: ArtifactEvidence, verification: VerificationRun): boolean {
  return (
    evidence.sourceSha === verification.sourceSha &&
    evidence.verificationId === verification.verificationId &&
    verification.conclusion === 'PASS' &&
    verification.checks.length > 0 &&
    /^[0-9a-f]{64}$/i.test(evidence.digest) &&
    evidence.artifactId.length > 0 &&
    evidence.mediaType.length > 0
  );
}

export type ContributionEvidenceBinding = Readonly<{ evidence: ArtifactEvidence; verification: VerificationRun }>;
export type ContributionEvidenceIndex = Readonly<Record<string, ContributionEvidenceBinding>>;
export type ContributionState = 'PROPOSED' | 'UNDER_REVIEW' | 'VERIFIED' | 'PUBLISHED' | 'REJECTED';

const CONTRIBUTION_TRANSITIONS: Readonly<Record<ContributionState, readonly ContributionState[]>> = Object.freeze({
  PROPOSED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['PUBLISHED'],
  PUBLISHED: [],
  REJECTED: [],
});

function evidenceIndexHasFreshPass(
  proposal: ContributionProposal,
  currentSha: string,
  evidenceIndex: ContributionEvidenceIndex,
): boolean {
  return proposal.evidenceIds.every((id) => {
    const binding = evidenceIndex[id];
    if (!binding) return false;
    return (
      binding.evidence.sourceSha === currentSha &&
      binding.verification.sourceSha === currentSha &&
      validateArtifactEvidence(binding.evidence, binding.verification)
    );
  });
}

export function validateContributionProposal(
  proposal: ContributionProposal,
  currentSha: string,
  evidenceIndex: ContributionEvidenceIndex,
): boolean {
  if (
    !/^[0-9a-f]{40}$/i.test(currentSha) ||
    !/^[0-9a-f]{40}$/i.test(proposal.sourceSha) ||
    proposal.proposalId.length < 3 ||
    proposal.contributorId.length < 2 ||
    proposal.summary.trim().length < 8 ||
    proposal.sourceSha !== currentSha ||
    proposal.evidenceIds.length === 0
  ) return false;
  return evidenceIndexHasFreshPass(proposal, currentSha, evidenceIndex);
}

export function canTransitionContribution(
  from: ContributionState,
  to: ContributionState,
  proposal: ContributionProposal,
  currentSha: string,
  evidenceIndex: ContributionEvidenceIndex,
): boolean {
  if (!CONTRIBUTION_TRANSITIONS[from].includes(to)) return false;
  if ((to === 'VERIFIED' || to === 'PUBLISHED') && !validateContributionProposal(proposal, currentSha, evidenceIndex)) return false;
  return true;
}

export function transitionContribution(
  from: ContributionState,
  to: ContributionState,
  proposal: ContributionProposal,
  currentSha: string,
  evidenceIndex: ContributionEvidenceIndex,
): ContributionState {
  if (!canTransitionContribution(from, to, proposal, currentSha, evidenceIndex)) throw new Error('CONTRIBUTION_TRANSITION_DENIED');
  return to;
}

export type SandboxPolicy = Readonly<{
  filesystem: 'EPHEMERAL';
  network: NetworkPolicy;
  limits: ResourceLimits;
  secrets: 'BROKERED_KEYS_ONLY';
}>;

export const DEFAULT_SANDBOX_POLICY: SandboxPolicy = Object.freeze({
  filesystem: 'EPHEMERAL',
  network: { mode: 'NONE' },
  limits: {
    timeoutMs: 10 * 60 * 1000,
    memoryMb: 1024,
    cpuSeconds: 300,
    outputMb: 32,
  },
  secrets: 'BROKERED_KEYS_ONLY',
});
