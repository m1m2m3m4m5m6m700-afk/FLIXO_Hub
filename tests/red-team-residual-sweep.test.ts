import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const REPO_ROOT = process.cwd();
const REQUIRED_COUNCIL_RPCS = [
  'council_claim_dispatch',
  'council_ack_dispatch',
  'council_heartbeat_dispatch',
  'council_complete_dispatch',
  'council_recover_expired_dispatches',
];

const workflowFiles = readdirSync(join(REPO_ROOT, '.github/workflows'))
  .filter((name) => /\.(?:ya?ml)$/u.test(name))
  .map((name) => join(REPO_ROOT, '.github/workflows', name));

test('red-team residual: every active GitHub Action uses an immutable commit SHA', () => {
  assert.ok(workflowFiles.length > 0);
  for (const file of workflowFiles) {
    const source = readFileSync(file, 'utf8');
    for (const line of source.split(/\r?\n/u)) {
      const match = line.match(/^\s+(?:-|)?\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/u);
      if (!match) continue;
      assert.match(match[1], /@[0-9a-f]{40}$/iu, 'Mutable or malformed Action reference in ' + file + ': ' + line.trim());
    }
  }
});

test('red-team residual: retired workflow and legacy agent-editor paths are absent', () => {
  const forbidden = [
    '.github/workflows/repository-security-baseline.yml',
    '.github/workflows/council-wake-push-relay.yml',
    'scripts/ci/repository-security-baseline.mjs',
    'scripts/ci/agent-communication.mjs',
    'db/council-external-accounts.sql',
    'apps/agent-editor',
    'packages/agent-runtime',
  ];
  for (const relative of forbidden) {
    assert.equal(existsSync(join(REPO_ROOT, relative)), false, 'Retired topology must remain absent: ' + relative);
  }
});

test('red-team residual: source-controlled council RPC migration covers the privileged runtime calls', () => {
  const migrationDir = join(REPO_ROOT, 'supabase/migrations');
  const sqlFiles = readdirSync(migrationDir).filter((name) => name.endsWith('.sql'));
  const corpus = sqlFiles.map((name) => readFileSync(join(migrationDir, name), 'utf8')).join('\n');
  const sourceControlled = REQUIRED_COUNCIL_RPCS.every((name) =>
    new RegExp('create\\s+or\\s+replace\\s+function\\s+public\\.' + name + '\\b', 'iu').test(corpus),
  );
  assert.equal(sourceControlled, true, 'All privileged runtime RPCs must be source-controlled');
  for (const name of REQUIRED_COUNCIL_RPCS) {
    const start = corpus.search(new RegExp('create\\s+or\\s+replace\\s+function\\s+public\\.' + name + '\\b', 'iu'));
    assert.notEqual(start, -1, 'Missing source-controlled definition: ' + name);
    const next = corpus.indexOf('create or replace function public.', start + 1);
    const body = corpus.slice(start, next === -1 ? corpus.length : next);
    assert.match(body, /security\\s+definer/iu, 'RPC must declare security definer: ' + name);
    assert.match(body, /set\\s+search_path\\s+to\\s+pg_catalog,\\s*public,\\s*pg_temp/iu, 'RPC search_path must be pinned: ' + name);
    assert.match(
      corpus,
      new RegExp('revoke\\s+all\\s+on\\s+function\\s+public\\.' + name + '\\b', 'iu'),
      'RPC must revoke public execution: ' + name,
    );
    assert.match(
      corpus,
      new RegExp('grant\\s+execute\\s+on\\s+function\\s+public\\.' + name + '\\b', 'iu'),
      'RPC must grant service_role execution: ' + name,
    );
  }
});

test('red-team residual: council runtime has no dead wake relay trust path', () => {
  const runtime = readFileSync(join(REPO_ROOT, 'supabase/functions/flixo-council-runtime/index.ts'), 'utf8');
  assert.doesNotMatch(runtime, /FLIXO Council Wake Push Relay/u);
  assert.match(runtime, /FLIXO Master Agent Activation Relay/u);
  assert.match(runtime, /COUNCIL_AGENT_IDENTITY_REJECTED/u);
  assert.match(runtime, /declaredAgentId !== runtime\.identity\?\.agentId/u);
});

test('red-team residual: vulnerable Vitest 3.2.4 Agent Editor dependency is absent', () => {
  const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
  const lock = readFileSync(join(REPO_ROOT, 'package-lock.json'), 'utf8');
  assert.equal(packageJson.workspaces?.includes?.('apps/agent-editor'), false);
  assert.doesNotMatch(lock, /vitest@?3\.2\.4|node_modules\/vitest[\s\S]{0,1200}"version":\s*"3\.2\.4"/iu);
});

test('red-team residual: current Red Team suite remains exact-SHA oriented and fail-closed', () => {
  const redTeam = readFileSync(join(REPO_ROOT, 'tests/red-team-control-plane.test.ts'), 'utf8');
  assert.match(redTeam, /confirmation cannot be transplanted or replayed/u);
  assert.match(redTeam, /forged\/stale plan fingerprint cannot be confirmed/u);
  assert.match(redTeam, /unknown and non-admitted capabilities are rejected before execution/u);
});
