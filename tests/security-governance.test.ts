import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

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
