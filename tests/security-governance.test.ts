import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { REQUIRED_CODEOWNERS, validateCodeowners } from '../scripts/verify-codeowners-coverage.mjs';

const repoRoot = process.cwd();

test('security-sensitive CODEOWNERS entries exist, are explicit, and resolve to the repository owner', () => {
  const content = readFileSync('.github/CODEOWNERS', 'utf8');
  const result = validateCodeowners(content, { repoRoot });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.covered.length, Object.keys(REQUIRED_CODEOWNERS).length);
});

test('CODEOWNERS malformed rule fails closed', () => {
  const malformed = ['* @m1m2m3m4m5m6m700-afk', '/.github/CODEOWNERS'].join('\n');
  const result = validateCodeowners(malformed, { repoRoot });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /requires a pattern and at least one owner/u);
});

test('CODEOWNERS missing high-impact coverage fails closed', () => {
  const content = readFileSync('.github/CODEOWNERS', 'utf8')
    .split(/\r?\n/u)
    .filter((line) => !line.startsWith('/src/config/registry.ts'))
    .join('\n');
  const result = validateCodeowners(content, { repoRoot });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /explicit CODEOWNERS coverage missing: \/src\/config\/registry\.ts/u);
});

test('required RT-17 paths are real repository paths; absent media path is not invented', () => {
  const requiredExisting = [
    '/.github/workflows/',
    '/.github/CODEOWNERS',
    '/.github/agents/',
    '/scripts/ci/',
    '/SECURITY.md',
    '/supabase/',
    '/api/admin/',
    '/src/server/admin/',
    '/src/config/registry.ts',
    '/src/lib/contracts/',
    '/src/lib/execution/',
    '/src/lib/agent-guided-runtime.ts',
    '/src/worker.ts',
    '/wrangler.jsonc',
    '/vercel.json',
  ];
  for (const path of requiredExisting) assert.equal(existsSync(repoRoot + path), true, path);
  assert.equal(existsSync(repoRoot + '/src/lib/media/'), false);
  const codeowners = readFileSync('.github/CODEOWNERS', 'utf8');
  assert.equal(codeowners.includes('/src/lib/media/'), false);
});

test('main ruleset verifier is dynamic and does not pin a historical ruleset id', () => {
  const verifier = readFileSync('scripts/ci/verify-main-ruleset.mjs', 'utf8');
  assert.doesNotMatch(verifier, /rulesets\/23854302/u);
  assert.match(verifier, /rulesets\?per_page=100/u);
  assert.match(verifier, /refs\/heads\/main/u);
  assert.match(verifier, /MAIN_GOVERNANCE=FAIL_CLOSED/u);
});

test('production security policy denies unused high-impact browser permissions', () => {
  const worker = readFileSync('src/worker.ts', 'utf8');
  assert.match(worker, /'Permissions-Policy': 'geolocation=\(\), microphone=\(\), camera=\(\)'/u);

  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    headers?: Array<{ source?: string; headers?: Array<{ key?: string; value?: string }> }>;
  };
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
