import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { assertWorkflowAuthority, classifyBranchRef, enumerateWorkflowAuthority } from '../scripts/ci/branch-authority-contract.mjs';

const repoRoot = process.cwd();
const OWNER = '@m1m2m3m4m5m6m700-afk';

test('security-sensitive CODEOWNERS entries are explicit and syntactically valid', () => {
  const lines = readFileSync('.github/CODEOWNERS', 'utf8')
    .split(/\r?\n/u)
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => line && !line.startsWith('#'));

  assert.ok(lines.length >= 2, 'CODEOWNERS must contain active rules');

  for (const { line, lineNumber } of lines) {
    const fields = line.split(/\s+/u);
    assert.ok(fields.length >= 2, `CODEOWNERS line ${lineNumber} must contain a pattern and owner`);
    for (const owner of fields.slice(1)) {
      assert.match(owner, /^@[A-Za-z0-9_.-]+$/u, `invalid CODEOWNERS owner on line ${lineNumber}`);
      assert.equal(owner, OWNER, `unexpected CODEOWNERS owner on line ${lineNumber}`);
    }
  }

  const ownedPaths = new Set(lines.map(({ line }) => line.split(/\s+/u)[0]));
  const required = [
    '/.github/workflows/',
    '/.github/CODEOWNERS',
    '/.github/agents/',
    '/scripts/ci/',
    '/supabase/',
    '/api/admin/',
    '/src/server/admin/',
    '/src/config/registry.ts',
    '/src/lib/contracts/',
    '/src/lib/execution/',
    '/src/lib/agent-guided-runtime.ts',
    '/src/lib/media/',
    '/src/worker.ts',
    '/wrangler.jsonc',
    '/vercel.json',
    '/SECURITY.md',
  ];

  for (const path of required) {
    assert.equal(ownedPaths.has(path), true, 'CODEOWNERS must explicitly cover: ' + path);
  }

  for (const target of ['.github/CODEOWNERS', '.github/workflows', 'scripts/ci', 'supabase', 'api', 'src/config/registry.ts', 'src/lib/contracts', 'src/lib/execution', 'src/lib/agent-guided-runtime.ts', 'src/worker.ts', 'wrangler.jsonc', 'vercel.json', 'SECURITY.md']) {
    assert.equal(existsSync(repoRoot + '/' + target), true, 'expected high-impact target must exist: ' + target);
  }
});

test('CODEOWNERS coverage does not imply mandatory enforcement', () => {
  const source = readFileSync('.github/CODEOWNERS', 'utf8');
  assert.match(source, /GitHub enforcement is separate/u);
  assert.match(source, /active main ruleset MUST require/u);
});

test('production security policy denies unused high-impact browser permissions', () => {
  const worker = readFileSync('src/worker.ts', 'utf8');
  assert.match(worker, /'Permissions-Policy': 'geolocation=\(\), microphone=\(\), camera=\(\)'/u);

  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const rootHeaders = vercel.headers?.find((entry) => entry.source === '/(.*)')?.headers ?? [];
  const permissions = rootHeaders.find((entry) => entry.key === 'Permissions-Policy')?.value;
  assert.equal(permissions, 'geolocation=(), microphone=(), camera=()');

  const csp = rootHeaders.find((entry) => entry.key === 'Content-Security-Policy')?.value ?? '';
  assert.match(csp, /default-src 'self'/u);
  assert.match(csp, /object-src 'none'/u);
  assert.match(csp, /frame-ancestors 'none'/u);
  assert.match(csp, /worker-src 'self' blob:/u);
  assert.equal(rootHeaders.find((entry) => entry.key === 'X-Content-Type-Options')?.value, 'nosniff');
  assert.equal(rootHeaders.find((entry) => entry.key === 'X-Frame-Options')?.value, 'DENY');
});

test('branch authority remains main-only for production and execution-only for promotion', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  const branchPolicy = readFileSync('scripts/ci/verify-branch-policy.mjs', 'utf8');
  const authority = readFileSync('scripts/verify-branch-authority.mjs', 'utf8');

  assert.match(ci, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/u);
  assert.match(ci, /HEAD_BRANCH != "execution" && ACTOR != "dependabot\[bot\]"/u);
  assert.match(branchPolicy, /refs\/heads\/main/uo);
  assert.match(branchPolicy, /refs\/heads\/execution/uo);
  assert.match(branchPolicy, /controlledAgent/u);
  assert.match(branchPolicy, /Unknown branch refs are untrusted/u);
  assert.doesNotMatch(ci, /production-deploy[\s\S]{0,12000}refs\/heads\/agent[-/]/u);
  assert.match(authority, /return 'unknown'/u);
});

test('certification lineage guard fails closed on stale current claims', () => {
  const lineage = readFileSync('scripts/verify-certification-lineage.mjs', 'utf8');
  assert.match(lineage, /m1m2m3m4m5m6m700-afk\/FLIXO_Hub/u);
  assert.match(lineage, /FLIXO-AI-TOOLS/u);
  assert.match(lineage, /LINEAGE_STALE_IDENTIFIER_ACTIVE/u);
  assert.match(lineage, /LINEAGE_RETIRED_PR_ACTIVE/u);
  assert.match(lineage, /Candidate SHA: \`REQUIRED\`/u);
  assert.match(lineage, /CURRENT_WORKFLOW_RUN: \`REQUIRED\`/u);
});


test('branch authority classifies approved Agent 3 compatibility lanes as controlled and never operational', () => {
  for (const ref of [
    'refs/heads/agent-3a/redteam-rt17-20261006',
    'refs/heads/agent-3b/redteam-rt19-20261006',
    'refs/heads/agent-3c/redteam-rt20-20261006',
    'refs/heads/agent3/verification-20261006',
    'refs/heads/agent-3/ux-browser-20261006',
    'refs/heads/agent-residual/redteam-closure-20261006',
  ]) {
    assert.equal(classifyBranchRef(ref), 'controlled agent');
  }
  assert.equal(classifyBranchRef('refs/heads/main'), 'operational');
  assert.equal(classifyBranchRef('refs/heads/execution'), 'operational');
  assert.equal(classifyBranchRef('refs/heads/unknown-branch'), 'unknown');
  assert.notEqual(classifyBranchRef('refs/heads/agent-3c/redteam-rt20-20261006'), 'operational');
});

test('branch authority enumerates every workflow and validates all authority-sensitive workflows', () => {
  const { readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const files = readdirSync(join(repoRoot, '.github/workflows'))
    .filter((name) => /.(?:ya?ml)$/u.test(name))
    .sort()
    .map((name) => ({ path: join('.github/workflows', name), source: readFileSync(join(repoRoot, '.github/workflows', name), 'utf8') }));
  const inventory = enumerateWorkflowAuthority(files);
  assert.equal(inventory.length, files.length);
  assertWorkflowAuthority(inventory);
  const ciEntry = inventory.find((entry) => entry.path === join('.github/workflows', 'ci.yml'));
  assert.ok(ciEntry);
  assert.equal(ciEntry.productionDeploy, true);
  assert.equal(ciEntry.promotion, true);
  assert.equal(ciEntry.authoritySensitive, true);
});
