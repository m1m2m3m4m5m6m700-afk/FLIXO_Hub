import type {
  PlatformCapabilityFamily,
  PlatformCapabilityState,
  PlatformExecutionMode,
} from './platform-contract';

export type PlatformCapability = Readonly<{
  id: string;
  family: PlatformCapabilityFamily;
  state: PlatformCapabilityState;
  executionMode: PlatformExecutionMode;
  authority: string;
  description: string;
}>;

export const PROGRAMMING_PLATFORM_CAPABILITIES: readonly PlatformCapability[] = Object.freeze([
  {
    id: 'platform.workspace.project',
    family: 'workspace',
    state: 'FOUNDATION',
    executionMode: 'READ_ONLY',
    authority: 'developer-platform-contract',
    description: 'Project manifest and workspace state.',
  },
  {
    id: 'platform.repository.github',
    family: 'repository',
    state: 'FOUNDATION',
    executionMode: 'READ_ONLY',
    authority: 'github-provider-boundary',
    description: 'Repository discovery and source identity.',
  },
  {
    id: 'platform.execution.sandbox',
    family: 'execution',
    state: 'FOUNDATION',
    executionMode: 'MUTATING',
    authority: 'execution-provider-contract',
    description: 'Ephemeral code execution with hard resource boundaries.',
  },
  {
    id: 'platform.verification.pipeline',
    family: 'verification',
    state: 'INTEGRATED',
    executionMode: 'TARGETED_VERIFY',
    authority: 'canonical-ci-and-verifiers',
    description: 'Tests, type checks, security, browser verification and exact-SHA proof.',
  },
  {
    id: 'platform.agents.cell',
    family: 'agents',
    state: 'INTEGRATED',
    executionMode: 'TARGETED_VERIFY',
    authority: 'cell-control-plane',
    description: 'Bounded delegation and agent evidence without second dispatch authority.',
  },
  {
    id: 'platform.artifacts.evidence',
    family: 'artifacts',
    state: 'INTEGRATED',
    executionMode: 'READ_ONLY',
    authority: 'evidence-fabric',
    description: 'Artifact and deployment evidence bound to source SHA.',
  },
  {
    id: 'platform.collaboration.review',
    family: 'collaboration',
    state: 'FOUNDATION',
    executionMode: 'READ_ONLY',
    authority: 'repository-provider-boundary',
    description: 'Review, issue and pull-request collaboration surface.',
  },
  {
    id: 'platform.contribution.proposal',
    family: 'contribution',
    state: 'FOUNDATION',
    executionMode: 'MUTATING',
    authority: 'canonical-admission-contract',
    description: 'Governed proposals for tools, agents, skills and extensions.',
  },
  {
    id: 'platform.learning.experience',
    family: 'learning',
    state: 'INTEGRATED',
    executionMode: 'READ_ONLY',
    authority: 'agent-learning-control-plane',
    description: 'Evidence-based lessons without granting new authority.',
  },
]);

const uniqueIds = new Set(PROGRAMMING_PLATFORM_CAPABILITIES.map((capability) => capability.id));

if (uniqueIds.size !== PROGRAMMING_PLATFORM_CAPABILITIES.length) {
  throw new Error('PROGRAMMING_PLATFORM_CAPABILITY_DUPLICATE_ID');
}

export function getProgrammingPlatformCapability(id: string): PlatformCapability | undefined {
  return PROGRAMMING_PLATFORM_CAPABILITIES.find((capability) => capability.id === id);
}
