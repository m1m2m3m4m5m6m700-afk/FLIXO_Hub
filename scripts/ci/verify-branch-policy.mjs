#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const allowed = new Set(['refs/heads/main', 'refs/heads/execution']);
const coordinationPrefix = /^refs\/heads\/(?:agent-(?:1|2|3|3a|3b|3c|4|residual)|agent3)\//u;

// Quarantine only known legacy refs that are already part of this repository's historical Agent 2 lane.
// This does not admit new legacy branch names; new refs still fail closed.
const legacyStaleRefs = new Set([
  'refs/heads/agent-2-media-engines-20261006',
]);
const output = execFileSync('git', ['ls-remote', '--heads', 'origin'], { encoding: 'utf8' });
const unexpected = output
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.split(/\s+/u)[1])
  .filter((ref) => ref && !allowed.has(ref) && !coordinationPrefix.test(ref) && !legacyStaleRefs.has(ref))
  .sort();

if (unexpected.length > 0) {
  console.error('BRANCH_POLICY=FAIL');
  console.error('Permitted refs are refs/heads/main, refs/heads/execution, and controlled Agent-1/Agent-2/Agent-3/Agent-4/Agent-residual coordination branches.');
  console.error(unexpected.join('\n'));
  process.exit(1);
}

for (const ref of legacyStaleRefs) {
  if (output.includes(ref)) console.warn(`BRANCH_POLICY=STALE_EXCEPTION ${ref}`);
}

console.log('BRANCH_POLICY=PASS');
