#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const required = [
  '.github/agents',
  '.github/workflows',
  'docs',
  'docs/architecture',
  'scripts/ci',
  'src/config',
  'src/lib/contracts',
  'src/lib/execution',
  'src/lib/video',
  'src/image-core',
  'src/routes',
  'src/components',
  'src/tools',
  'api/admin',
  'packages/contracts',
  'tests/official',
  'tests/e2e',
  'tests/helpers',
  'tests/fixtures',
  'supabase',
  'public',
];

const forbidden = [
  'docs/security.md',
  'apps/agent-editor',
  'packages/agent-runtime',
  'src/lib/agent/capability-registry.ts',
  'src/lib/agent/execution-gate.ts',
  'src/lib/workflows/executor-registry.ts',
  'src/lib/workflows/canonical-local-execution.ts',
];

const failures = [];
for (const path of required) {
  if (!existsSync(path)) failures.push(`missing required path: ${path}`);
}

let tracked = [];
try {
  tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
} catch (error) {
  failures.push(`unable to inspect tracked files: ${error instanceof Error ? error.message : String(error)}`);
}

for (const path of forbidden) {
  const present = tracked.some((entry) => entry === path || entry.startsWith(`${path}/`));
  if (present) failures.push(`forbidden legacy path is tracked: ${path}`);
}

const agentProfiles = tracked.filter((path) => path.startsWith('.github/agents/') && path.endsWith('.md'));
if (agentProfiles.length === 0) failures.push('no executable agent profiles found under .github/agents/');
const legacyAgentDocs = tracked.filter((path) => path.startsWith('docs/agents/') && path !== 'docs/agents/README.md');
if (legacyAgentDocs.length > 0) failures.push(`executable agent profile leaked into docs/agents/: ${legacyAgentDocs.join(', ')}`);

const lockfiles = tracked.filter((path) => /^(?:pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|package-lock\.json)$/u.test(path));
if (!tracked.includes('package-lock.json')) failures.push('package-lock.json is missing');
if (lockfiles.length !== 1 || lockfiles[0] !== 'package-lock.json') failures.push(`lockfile policy violation: ${lockfiles.join(', ') || 'none'}`);

const generatedTracked = tracked.filter((path) => /^(?:dist|playwright-report|test-results)\/|(?:^|\/)routeTree\.gen\.ts$/u.test(path));
if (generatedTracked.length > 0) failures.push(`generated artifact is tracked: ${generatedTracked.slice(0, 10).join(', ')}`);

if (failures.length) {
  console.error('REPOSITORY_STRUCTURE=FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('REPOSITORY_STRUCTURE=PASS');
console.log(`Required paths: ${required.length}`);
console.log(`Agent profiles: ${agentProfiles.length}`);
console.log(`Tracked files inspected: ${tracked.length}`);
