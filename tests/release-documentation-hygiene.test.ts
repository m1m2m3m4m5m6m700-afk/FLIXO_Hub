import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

test('current-state documentation does not advertise removed runtime modules as live implementation', () => {
  const tasks = readFileSync(resolve(root, 'المهام.md'), 'utf8');
  assert.doesNotMatch(tasks, /tests\/core-contracts\.test\.ts|tests\/mvp-100-proof\.test\.ts/u);
  for (const path of [
    'src/lib/agent/model-resilience.ts',
    'src/lib/agent/tool-plan-validator.ts',
    'src/lib/agent/structured-errors.ts',
    'src/lib/agent/execution-observability.ts',
    'src/lib/agent/idempotency.ts',
    'api/flixo-agent.ts',
  ]) {
    assert.equal(tasks.includes(path), false, path);
  }
});

test('current release documents do not pin the retired PR #1002 as the active candidate', () => {
  const documents = [
    'PROJECTS.md',
    'المهام.md',
    'docs/FLIXO-FINAL-RELEASE-CERTIFICATION.md',
    'docs/FLIXO-FINAL-CERTIFICATION-ATTESTATION.md',
    'docs/FLIXO-PUBLIC-RELEASE-MANIFEST.md',
    'docs/TOOL-EXPANSION-AUDIT.md',
    'docs/FLIXO-EXECUTION-LEDGER.md',
    'docs/FLIXO-EXACT-SHA-CERTIFICATION.md',
    'docs/FLIXO-PROMPT-01-STATE.md',
  ].map((path) => readFileSync(resolve(root, path), 'utf8'));

  for (const document of documents) {
    assert.doesNotMatch(document, /active release candidate.*PR #1002/iu);
    assert.doesNotMatch(document, /current release candidate: PR #1002/iu);
    assert.doesNotMatch(document, /live PR #1002/iu);
    assert.doesNotMatch(document, /active release candidate.*PR #1002/iu);
  }
});

test('agent documentation has one executable profile location', () => {
  const profileDir = resolve(root, '.github/agents');
  const docsReadme = readFileSync(resolve(root, 'docs/agents/README.md'), 'utf8');

  assert.equal(existsSync(profileDir), true);
  assert.match(docsReadme, /\.github\/agents\//u);
  assert.doesNotMatch(docsReadme, /second runtime authority|second registry|second executor/iu);
});

test('repository structure documentation names the canonical locations', () => {
  const structure = readFileSync(resolve(root, 'docs/REPOSITORY-STRUCTURE.md'), 'utf8');
  assert.match(structure, /`\.github\/agents\/`/u);
  assert.match(structure, /`scripts\/ci\/`/u);
  assert.match(structure, /`src\/config\/`/u);
  assert.match(structure, /`src\/lib\/execution\/`/u);
  assert.match(structure, /`tests\/official\/`/u);
  assert.match(structure, /`main`, `execution`/u);
  assert.match(structure, /`agent-1\/\*`, `agent-2\/\*`, `agent-3\/\*`/u);
});

test('security documentation matches active release workflows and does not reference a phantom Socket gate', () => {
  const security = readFileSync(resolve(root, 'SECURITY.md'), 'utf8');
  const contributing = readFileSync(resolve(root, 'CONTRIBUTING.md'), 'utf8');
  for (const document of [security, contributing]) {
    assert.equal(/SOCKET_SECURITY_API_KEY|Release Certification.*workflow/iu.test(document), false);
    assert.match(document, /CodeQL/u);
    assert.match(document, /Red-Team/u);
  }
});

