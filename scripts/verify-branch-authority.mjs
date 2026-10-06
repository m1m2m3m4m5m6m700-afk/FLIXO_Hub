import { execFileSync } from 'node:child_process';

const OPERATIONAL_REFS = new Set(['refs/heads/main', 'refs/heads/execution']);
const CONTROLLED_AGENT_REFS = /^refs\/heads\/(?:agent-(?:1|2|3|4)|agent3)\//u;
const STALE_REFS = new Set(['refs/heads/agent-2-media-engines-20261006']);

export function classifyBranchRef(ref) {
  if (OPERATIONAL_REFS.has(ref)) return 'operational';
  if (STALE_REFS.has(ref)) return 'stale';
  if (CONTROLLED_AGENT_REFS.test(ref)) return 'controlled agent';
  return 'unknown';
}

const source = execFileSync('git', ['ls-remote', '--heads', 'origin'], { encoding: 'utf8' });
const refs = source
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.split(/\s+/u)[1])
  .filter(Boolean);

const byClass = { operational: [], 'controlled agent': [], historical: [], stale: [], unknown: [] };
for (const ref of refs) {
  const classification = classifyBranchRef(ref);
  byClass[classification].push(ref);
}

const unknown = byClass.unknown.sort();
if (unknown.length) {
  console.error('BRANCH_AUTHORITY=FAIL');
  console.error('Unknown refs must never become trusted production authority:');
  console.error(unknown.join('\n'));
  process.exit(1);
}

if (!byClass.operational.includes('refs/heads/main') || !byClass.operational.includes('refs/heads/execution')) {
  throw new Error('BRANCH_AUTHORITY_OPERATIONAL_REFS_MISSING');
}

const fs = await import('node:fs/promises');
const ci = await fs.readFile('.github/workflows/ci.yml', 'utf8');
const finalRedTeam = await fs.readFile('.github/workflows/final-red-team.yml', 'utf8');
if (!ci.includes("if: github.event_name == 'push' && github.ref == 'refs/heads/main'")) {
  throw new Error('PRODUCTION_AUTHORITY_NOT_MAIN_ONLY');
}
if (!ci.includes("HEAD_BRANCH != \"execution\" && ACTOR != \"dependabot[bot]\"")) {
  throw new Error('MAIN_PROMOTION_SOURCE_NOT_EXECUTION_ONLY');
}
if (/production-deploy[\s\S]{0,12000}refs\/heads\/agent[-/]/u.test(ci)) {
  throw new Error('AGENT_REF_HAS_PRODUCTION_AUTHORITY');
}
if (!finalRedTeam.includes('pull_request:\n    branches: [main]')) {
  throw new Error('FINAL_RED_TEAM_MAIN_PROMOTION_SCOPE_CHANGED');
}

for (const ref of refs) {
  if (classifyBranchRef(ref) === 'controlled agent') {
    console.log(`BRANCH_AUTHORITY_CONTROLLED_AGENT=${ref}`);
  }
}
for (const ref of byClass.stale) {
  console.log(`BRANCH_AUTHORITY_STALE_UNTRUSTED=${ref}`);
}

console.log('BRANCH_AUTHORITY_PASS=main|execution|agent-scoped-no-production-trust');
