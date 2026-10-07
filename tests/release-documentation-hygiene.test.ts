import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

test('current-state documentation does not advertise removed runtime modules as live implementation', () => {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
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

test('security documentation matches active release workflows and does not reference a phantom Socket gate', () => {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const security = readFileSync(resolve(root, 'SECURITY.md'), 'utf8');
  const contributing = readFileSync(resolve(root, 'CONTRIBUTING.md'), 'utf8');
  for (const document of [security, contributing]) {
    assert.equal(/SOCKET_SECURITY_API_KEY|Release Certification.*workflow/iu.test(document), false);
    assert.match(document, /CodeQL/u);
    assert.match(document, /Red-Team/u);
  }
});
