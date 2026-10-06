import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONTROLLED_AGENT_REF,
  HISTORICAL_REFS,
  OPERATIONAL_REFS,
  STALE_REFS,
  assertWorkflowAuthority,
  classifyBranchRef,
  enumerateWorkflowAuthority,
} from './ci/branch-authority-contract.mjs';
import { execFileSync } from 'node:child_process';

export {
  CONTROLLED_AGENT_REF,
  HISTORICAL_REFS,
  OPERATIONAL_REFS,
  STALE_REFS,
  assertWorkflowAuthority,
  classifyBranchRef,
  enumerateWorkflowAuthority,
};

const source = execFileSync('git', ['ls-remote', '--heads', 'origin'], { encoding: 'utf8' });
const refs = source
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.split(/\s+/u)[1])
  .filter(Boolean);

const byClass = { operational: [], 'controlled agent': [], historical: [], stale: [], unknown: [] };
for (const ref of refs) {
  byClass[classifyBranchRef(ref)].push(ref);
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

const workflowDir = '.github/workflows';
const workflowFiles = readdirSync(workflowDir)
  .filter((name) => /\.(?:ya?ml)$/u.test(name))
  .sort()
  .map((name) => ({ path: join(workflowDir, name), source: readFileSync(join(workflowDir, name), 'utf8') }));

const workflowInventory = enumerateWorkflowAuthority(workflowFiles);
assertWorkflowAuthority(workflowInventory);

for (const entry of workflowInventory) {
  console.log(
    `BRANCH_AUTHORITY_WORKFLOW=${entry.path}|productionDeploy=${entry.productionDeploy}|promotion=${entry.promotion}|authoritySensitive=${entry.authoritySensitive}`,
  );
}

for (const ref of refs) {
  if (classifyBranchRef(ref) === 'controlled agent') {
    console.log(`BRANCH_AUTHORITY_CONTROLLED_AGENT=${ref}`);
  }
}
for (const ref of byClass.stale) {
  console.log(`BRANCH_AUTHORITY_STALE_UNTRUSTED=${ref}`);
}
if (byClass.historical.length === 0) {
  console.log('BRANCH_AUTHORITY_HISTORICAL=NONE_OBSERVED');
} else {
  for (const ref of byClass.historical) console.log(`BRANCH_AUTHORITY_HISTORICAL_UNTRUSTED=${ref}`);
}

console.log('BRANCH_AUTHORITY_PASS=main|execution|agent-scoped-no-production-trust|all-workflows-enumerated');
