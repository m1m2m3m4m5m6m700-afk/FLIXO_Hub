import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const repoRoot = process.cwd();

test('security-sensitive CODEOWNERS entries point at real repository paths', () => {
  const codeowners = readFileSync('.github/CODEOWNERS', 'utf8');
  const expected = [
    '/.github/workflows/',
    '/.github/CODEOWNERS',
    '/scripts/ci/',
    '/SECURITY.md',
    '/docs/agents/',
    '/supabase/',
    '/api/',
    '/src/lib/contracts/',
    '/src/lib/execution/',
    '/src/worker.ts',
    '/wrangler.jsonc',
    '/vercel.json',
  ];

  for (const path of expected) {
    assert.equal(existsSync(repoRoot + path), true, 'CODEOWNERS target must exist: ' + path);
    const escaped = path.replace(/[.*+?^${}()|[\\]\\]/gu, '\\$&');
    assert.match(codeowners, new RegExp('^' + escaped + '\\s+', 'm'));
  }

  assert.doesNotMatch(codeowners, /^\\/docs\\/security\\.md\\s+/mu);
});

test('production security policy denies unused high-impact browser permissions', () => {
  const worker = readFileSync('src/worker.ts', 'utf8');
  assert.match(worker, /'Permissions-Policy': 'geolocation=\\(\\), microphone=\\(\\), camera=\\(\\)'/u);

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
  assert.equal(
    rootHeaders.find((entry) => entry.key === 'X-Content-Type-Options')?.value,
    'nosniff',
  );
  assert.equal(rootHeaders.find((entry) => entry.key === 'X-Frame-Options')?.value, 'DENY');
});
