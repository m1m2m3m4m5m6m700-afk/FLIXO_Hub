import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('RT3: execution workflow is secretless because execution is not protected', () => {
  const workflow = readFileSync('.github/workflows/testsprite-execution.yml', 'utf8');

  assert.match(
    workflow,
    /execution is intentionally unprotected\. This workflow MUST remain secretless\./u,
  );
  assert.doesNotMatch(workflow, /secrets\.TESTSPRITE_API_KEY/u);
  assert.doesNotMatch(workflow, /vars\.TESTSPRITE_PROJECT_ID/u);
  assert.doesNotMatch(workflow, /TESTSPRITE_API_KEY/u);
  assert.doesNotMatch(workflow, /TESTSPRITE_PROJECT_ID/u);
});

test('RT3: every active Action in the execution workflow is pinned to an immutable commit SHA', () => {
  const workflow = readFileSync('.github/workflows/testsprite-execution.yml', 'utf8');
  for (const line of workflow.split(/\r?\n/u)) {
    const match = line.match(/^\s+uses:\s*([^\s#]+)(?:\s+#.*)?$/u);
    if (!match) continue;
    assert.match(match[1], /@[0-9a-f]{40}$/iu, 'Mutable Action reference: ' + line.trim());
  }
});

test('RT3: the CI trust path remains fail-closed on governance and Red Team gates', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(workflow, /name: Branch policy/u);
  assert.match(workflow, /node scripts\/ci\/verify-main-ruleset\.mjs/u);
  assert.match(workflow, /name: Red Team adversarial regression/u);
  assert.match(workflow, /test "\$TRUST_RESULT" = success/u);
});
