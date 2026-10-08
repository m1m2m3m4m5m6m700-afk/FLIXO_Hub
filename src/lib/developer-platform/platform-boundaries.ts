import type { NetworkPolicy, PlatformExecutionRequest, ProgrammingProjectManifest, ResourceLimits } from './platform-contract';

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
  | Readonly<{
      kind: 'COMMIT';
      repository: string;
      branch: string;
      expectedHeadSha: string;
      taskId: string;
      agentId: string;
      message: string;
    }>
  | Readonly<{
      kind: 'PULL_REQUEST';
      repository: string;
      base: string;
      head: string;
      expectedHeadSha: string;
      taskId: string;
      agentId: string;
    }>;

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

export interface PlatformExecutionProvider {
  readonly id: string;
  readonly supportsNetworkPolicy: boolean;
  readonly supportsResourceLimits: boolean;
  readonly supportsCancellation: boolean;
  execute(request: PlatformExecutionRequest): Promise<{
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

export function validateRepositoryMutation(
  mutation: RepositoryMutation,
  snapshot: RepositorySnapshot,
): boolean {
  if (!mutation.taskId.startsWith('EXEC-') || mutation.agentId.length < 2) return false;
  if (mutation.repository !== snapshot.repository) return false;
  if (mutation.expectedHeadSha !== snapshot.headSha) return false;

  if (mutation.kind === 'COMMIT') return mutation.branch !== 'main' && mutation.message.trim().length > 0;
  return mutation.base === 'main' && mutation.head !== 'main';
}

export function validateArtifactEvidence(evidence: ArtifactEvidence, verification: VerificationRun): boolean {
  return (
    evidence.sourceSha === verification.sourceSha &&
    evidence.verificationId === verification.verificationId &&
    verification.conclusion === 'PASS' &&
    /^[0-9a-f]{64}$/i.test(evidence.digest) &&
    evidence.artifactId.length > 0 &&
    evidence.mediaType.length > 0
  );
}

export function validateContributionProposal(
  proposal: ContributionProposal,
  currentSha: string,
): boolean {
  return (
    /^[0-9a-f]{40}$/i.test(currentSha) &&
    /^[0-9a-f]{40}$/i.test(proposal.sourceSha) &&
    proposal.proposalId.length >= 3 &&
    proposal.contributorId.length >= 2 &&
    proposal.summary.trim().length >= 8 &&
    proposal.sourceSha === currentSha &&
    proposal.evidenceIds.length > 0
  );
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
