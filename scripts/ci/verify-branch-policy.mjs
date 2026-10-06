#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const operational = new Set(['refs/heads/main', 'refs/heads/execution']);
const controlledAgent = /^refs\/heads\/(?:agent-(?:1|2|3|4)|agent3)\//u;
const legacyStale = new Set(['refs/heads/agent-2-media-engines-20261006']);

const output = execFileSync('git', ['ls-remote', '--heads', 'origin'], { encoding: 'utf8' });
const refs = output
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.split(/\s+/u)[1])
  .filter(Boolean);

const unknown = refs
  .filter((ref) => !operational.has(ref) && !controlledAgent.test(ref) && !legacyStale.has(ref))
  .sort();

if (!refs.includes('refs/heads/main') || !refs.includes('refs/heads/execution')) {
  console.error('BRANCH_POLICY=FAIL');
  console.error('Operational authority refs/heads/main and refs/heads/execution must exist.');
  process.exit(1);
}

if (unknown.length > 0) {
  console.error('BRANCH_POLICY=FAIL');
  console.error('Unknown branch refs are untrusted and must fail closed:');
  console.error(unknown.join('\n'));
  process.exit(1);
}

for (const ref of refs.filter((candidate) => controlledAgent.test(candidate)).sort()) {
  console.warn(`BRANCH_POLICY=CONTROLLED_AGENT_UNTRUSTED_PRODUCTION ${ref}`);
}
for (const ref of refs.filter((candidate) => legacyStale.has(candidate))) {
  console.warn(`BRANCH_POLICY=STALE_UNTRUSTED ${ref}`);
}

console.log('BRANCH_POLICY=PASS operational=main|execution production-authority=main integration-authority=execution');
