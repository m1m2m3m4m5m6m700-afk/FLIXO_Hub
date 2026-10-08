import type { ContributionProposal } from './platform-boundaries';

export type ContributionKind =
  | 'PROJECT_TEMPLATE' | 'TOOL' | 'AGENT' | 'SKILL' | 'VERIFIER'
  | 'RUNTIME_ADAPTER' | 'DOCS' | 'WORKFLOW' | 'TEMPLATE';

export type ContributionStatus =
  | 'CORE_REFERENCE' | 'PROPOSED' | 'VALIDATING' | 'VERIFIED' | 'PUBLISHED' | 'DEPRECATED';

export type ContributionRecord = Readonly<{
  id: string;
  slug: string;
  title: string;
  summary: string;
  kind: ContributionKind;
  status: ContributionStatus;
  version: string;
  contributor: string;
  license: string;
  sourcePaths: readonly string[];
  docsPaths: readonly string[];
  reuse: string;
  evidencePolicy: 'EXACT_SHA_REQUIRED';
  admission: 'GITHUB_PR';
}>;

export const CONTRIBUTION_REGISTRY_VERSION = '1.0.0';

export const CONTRIBUTION_REGISTRY: readonly ContributionRecord[] = Object.freeze([
  {
    id: 'core.local-project-workspace',
    slug: 'local-project-workspace',
    title: 'Local Project Workspace',
    summary: 'Browser-local project import, text editing, file creation, and ZIP export with no automatic upload.',
    kind: 'TOOL',
    status: 'CORE_REFERENCE',
    version: '1.0.0',
    contributor: 'FLIXO Core',
    license: 'Apache-2.0',
    sourcePaths: ['src/lib/developer-platform/local-project-workspace.ts'],
    docsPaths: ['src/pages/developer-workspace.tsx', 'docs/CONTRIBUTIONS.md'],
    reuse: 'Browser-local developer workflows',
    evidencePolicy: 'EXACT_SHA_REQUIRED',
    admission: 'GITHUB_PR',
  },
  {
    id: 'core.platform-boundaries',
    slug: 'platform-boundaries',
    title: 'Platform Boundary Contracts',
    summary: 'Repository, artifact, execution, sandbox, and contribution admission boundaries with exact-source checks.',
    kind: 'VERIFIER',
    status: 'CORE_REFERENCE',
    version: '1.0.0',
    contributor: 'FLIXO Core',
    license: 'Apache-2.0',
    sourcePaths: ['src/lib/developer-platform/platform-contract.ts', 'src/lib/developer-platform/platform-boundaries.ts'],
    docsPaths: ['docs/CONTRIBUTIONS.md', 'src/pages/developer-platform.tsx'],
    reuse: 'Extension admission and verification design',
    evidencePolicy: 'EXACT_SHA_REQUIRED',
    admission: 'GITHUB_PR',
  },
]);

const VALID_KINDS: readonly ContributionKind[] = [
  'PROJECT_TEMPLATE', 'TOOL', 'AGENT', 'SKILL', 'VERIFIER',
  'RUNTIME_ADAPTER', 'DOCS', 'WORKFLOW', 'TEMPLATE',
];

export function validateContributionRecord(record: ContributionRecord): boolean {
  return (
    /^[a-z0-9][a-z0-9.-]{2,80}$/.test(record.id) &&
    /^[a-z0-9][a-z0-9-]{2,80}$/.test(record.slug) &&
    record.title.trim().length >= 3 &&
    record.summary.trim().length >= 12 &&
    VALID_KINDS.includes(record.kind) &&
    /^\d+\.\d+\.\d+$/.test(record.version) &&
    record.contributor.trim().length >= 2 &&
    record.license.trim().length >= 2 &&
    record.sourcePaths.length > 0 &&
    record.sourcePaths.every((path) => path.trim().length > 0 && !path.includes('..')) &&
    record.docsPaths.every((path) => path.trim().length > 0 && !path.includes('..')) &&
    record.reuse.trim().length >= 3 &&
    record.evidencePolicy === 'EXACT_SHA_REQUIRED' &&
    record.admission === 'GITHUB_PR'
  );
}

export function getPublishedContributions(): readonly ContributionRecord[] {
  return CONTRIBUTION_REGISTRY.filter((record) => record.status === 'PUBLISHED');
}

export function contributionKinds(): readonly ContributionKind[] {
  return VALID_KINDS;
}

export function proposalToRegistryCandidate(
  proposal: ContributionProposal,
): Pick<ContributionRecord, 'id' | 'summary' | 'kind' | 'status' | 'evidencePolicy' | 'admission'> {
  return {
    id: proposal.proposalId,
    summary: proposal.summary,
    kind: proposal.kind,
    status: 'PROPOSED',
    evidencePolicy: 'EXACT_SHA_REQUIRED',
    admission: 'GITHUB_PR',
  };
}
