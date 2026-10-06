#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const operationalRefs = new Set(['refs/heads/main', 'refs/heads/execution']);
const coordinationPatterns = [
  /^refs\/heads\/agent-(?:1|2|3|4)\/[A-Za-z0-9._-]+-\d{8}$/u,
  /^refs\/heads\/agent3\/[A-Za-z0-9._-]+-\d{8}$/u,
];

// Explicit quarantine for the one known historical flat Agent 2 ref.
// It is visible for cleanup/audit only and is never an approved promotion source.
const legacyStaleRefs = new Set([
  'refs/heads/agent-2-media-engines-20261006',
]);

const output = execFileSync('git', ['ls-remote', '--heads', 'origin'], { encoding: 'utf8' });
const refs = output
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.split(/\s+/u)[1])
  .filter(Boolean);

const remoteRefs = new Set(refs);
for (const required of operationalRefs) {
  if (!remoteRefs.has(required)) {
    console.error('BRANCH_POLICY=FAIL');
    console.error(`Missing required operational ref: ${required}`);
    process.exit(1);
  }
}

const unexpected = refs
  .filter((ref) => {
    if (operationalRefs.has(ref)) return false;
    if (legacyStaleRefs.has(ref)) return false;
    return !coordinationPatterns.some((pattern) => pattern.test(ref));
  })
  .sort();

if (unexpected.length > 0) {
  console.error('BRANCH_POLICY=FAIL');
  console.error('Permitted refs are refs/heads/main, refs/heads/execution, and dated agent coordination branches.');
  console.error('Unknown or newly created legacy-style refs are rejected fail-closed.');
  console.error(unexpected.join('\n'));
  process.exit(1);
}

for (const ref of legacyStaleRefs) {
  if (remoteRefs.has(ref)) {
    console.warn(`BRANCH_POLICY=STALE_EXCEPTION ${ref}`);
    console.warn('This ref is quarantined and must not be accepted as promotion lineage.');
  }
}

console.log('BRANCH_POLICY=PASS');