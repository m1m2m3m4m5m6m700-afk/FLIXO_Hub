#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  HISTORICAL_REFS,
  OPERATIONAL_REFS,
  STALE_REFS,
  assertWorkflowAuthority,
  classifyBranchRef,
  enumerateWorkflowAuthority,
} from './branch-authority-contract.mjs';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const output = execFileSync('git', ['ls-remote', '--heads', 'origin'], { encoding: 'utf8' });
const refs = output
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.split(/\s+/u)[1])
  .filter(Boolean);

const classified = { operational: [], 'controlled agent': [], historical: [], stale: [], unknown: [] };
for (const ref of refs) classified[classifyBranchRef(ref)].push(ref);

if (!refs.includes('refs/heads/main') || !refs.includes('refs/heads/execution')) {
  console.error('BRANCH_POLICY=FAIL');
  console.error('Operational authority refs/heads/main and refs/heads/execution must exist.');
  process.exit(1);
}

if (classified.unknown.length > 0) {
  console.error('BRANCH_POLICY=FAIL');
  console.error('Unknown branch refs are untrusted and must fail closed:');
  console.error(classified.unknown.sort().join('\n'));
  process.exit(1);
}

const workflowFiles = readdirSync('.github/workflows')
  .filter((name) => /\.(?:ya?ml)$/u.test(name))
  .sort()
  .map((name) => ({ path: join('.github/workflows', name), source: readFileSync(join('.github/workflows', name), 'utf8') }));
const workflowInventory = enumerateWorkflowAuthority(workflowFiles);

try {
  assertWorkflowAuthority(workflowInventory);
} catch (error) {
  console.error('BRANCH_POLICY=FAIL');
  console.error(String(error?.message ?? error));
  process.exit(1);
}

for (const ref of classified['controlled agent'].sort()) {
  console.warn(`BRANCH_POLICY=CONTROLLED_AGENT_UNTRUSTED_PRODUCTION ${ref}`);
}
for (const ref of classified.stale) {
  console.warn(`BRANCH_POLICY=STALE_UNTRUSTED ${ref}`);
}
for (const ref of classified.historical) {
  console.warn(`BRANCH_POLICY=HISTORICAL_UNTRUSTED ${ref}`);
}

for (const entry of workflowInventory) {
  console.log(
    `BRANCH_POLICY_WORKFLOW=${entry.path}|productionDeploy=${entry.productionDeploy}|promotion=${entry.promotion}|authoritySensitive=${entry.authoritySensitive}`,
  );
}

console.log('BRANCH_POLICY=PASS operational=main|execution production-authority=main integration-authority=execution all-workflows-enumerated');
