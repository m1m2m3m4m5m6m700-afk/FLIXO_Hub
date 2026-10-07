import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const repoRoot = process.cwd();

test('security-sensitive CODEOWNERS entries point at real repository paths', () => {
  const lines = readFileSync('.github/CODEOWNERS', 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  const ownedPaths = new Set(lines.map((line) => line.split(/\s+/u)[0]));
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
    assert.equal(ownedPaths.has(path), true, 'CODEOWNERS must explicitly cover: ' + path);
  }

  assert.equal(ownedPaths.has('/docs/security.md'), false);
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
  assert.equal(
    rootHeaders.find((entry) => entry.key === 'X-Content-Type-Options')?.value,
    'nosniff',
  );
  assert.equal(rootHeaders.find((entry) => entry.key === 'X-Frame-Options')?.value, 'DENY');
});


test('privileged publication workflows execute from trusted main and keep candidate workflows read-only', () => {
  const triage = readFileSync('.github/workflows/triage-and-clean.yml', 'utf8');
  const controller = readFileSync('.github/workflows/patch-capsule-controller.yml', 'utf8');
  const human = readFileSync('.github/workflows/human-gate.yml', 'utf8');
  const agentPublisher = readFileSync('.github/workflows/agent3-trusted-publication.yml', 'utf8');
  const knowledgePublisher = readFileSync('.github/workflows/knowledge-trusted-publication.yml', 'utf8');
  const humanPublisher = readFileSync('.github/workflows/human-gate-trusted-publication.yml', 'utf8');

  assert.doesNotMatch(triage, /contents:\s*write/iu);
  assert.doesNotMatch(triage, /persist-credentials:\s*true/iu);
  assert.doesNotMatch(triage, /git\s+push\b/iu);
  assert.match(controller, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(controller, /ref: main/u);
  assert.match(controller, /persist-credentials: false/u);
  assert.match(controller, /contents: write/u);
  assert.doesNotMatch(human, /contents:\s*write/iu);
  assert.doesNotMatch(human, /git\s+push\b/iu);
  for (const publisher of [agentPublisher, knowledgePublisher, humanPublisher]) {
    assert.match(publisher, /workflow_run:/u);
    assert.match(publisher, /ref: main/u);
    assert.match(publisher, /persist-credentials: false/u);
    assert.match(publisher, /contents: write/u);
  }
});
