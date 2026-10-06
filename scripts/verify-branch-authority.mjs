import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ci = readFileSync(resolve('.github/workflows/ci.yml'), 'utf8');
const secret = readFileSync(resolve('.github/workflows/secret-scan.yml'), 'utf8');
const failures = [];

if (!ci.includes("if: github.event_name == 'push' && github.ref == 'refs/heads/main'")) failures.push('production deployment is not restricted to push on main');
if (!ci.includes('HEAD_BRANCH != "execution" && ACTOR != "dependabot[bot]"')) failures.push('main promotion proof no longer requires execution as the PR source branch');
if (!secret.includes('branches: [main, execution]')) failures.push('secret scan is not required on both main and execution PRs');
if (/refs\/heads\/agent[-/]/u.test(ci)) failures.push('agent branches are treated as production refs in CI');

if (failures.length) {
  console.error('[branch-authority] BLOCKED');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}
console.log('[branch-authority] PASS: production authority remains main-only and main promotion is execution-only');