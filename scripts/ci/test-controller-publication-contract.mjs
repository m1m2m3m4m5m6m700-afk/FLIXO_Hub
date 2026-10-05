import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('controller publication contract is execution-only, non-force, and controller-gated', async () => {
  const script = await readFile(new URL('./controller-reconcile-and-publish.mjs', import.meta.url), 'utf8');
  const workflow = await readFile(new URL('../../.github/workflows/patch-capsule-controller.yml', import.meta.url), 'utf8');

  assert.ok(script.includes("const BRANCH = 'execution'"));
  assert.ok(script.includes("FLIXO_CANONICAL_CONTROLLER !== CONTROLLER"));
  assert.ok(script.includes("process.env.FLIXO_TARGET_BRANCH ?? ''"));
  assert.ok(script.includes("HEAD:refs/heads/${BRANCH}"));
  assert.ok(!script.includes('--force-with-lease'));
  assert.ok(!script.includes("['--force'"));
  assert.ok(!script.includes('refs/heads/main'));
  assert.ok(script.includes("git', ['push', '--porcelain', 'origin'"));
  assert.ok(script.includes("git(['rev-parse', 'HEAD^']"));
  assert.ok(workflow.includes('contents: write'));
  assert.ok(workflow.includes('ref: execution'));
  assert.ok(!workflow.includes('create_branch'));
  assert.ok(!workflow.includes('git switch -c'));
  assert.ok(!workflow.includes('git checkout -b'));
  assert.ok(workflow.includes('cancel-in-progress: false'));
});
