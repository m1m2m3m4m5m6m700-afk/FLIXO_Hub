import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('controller publication contract is execution-only, non-force, and controller-gated', async () => {
  const script = await readFile(new URL('./controller-reconcile-and-publish.mjs', import.meta.url), 'utf8');
  const workflow = await readFile(new URL('../../.github/workflows/patch-capsule-controller.yml', import.meta.url), 'utf8');

  assert.match(script, /FLIXO_CANONICAL_CONTROLLER.*assistantController|CONTROLLER.*assistantController/s);
  assert.match(script, /refs\\/heads\\/\\$\\{BRANCH\\}/);
  assert.match(script, /const BRANCH = 'execution'/);
  assert.doesNotMatch(script, /--force(?!\\w)|--force-with-lease/);
  assert.doesNotMatch(script, /refs\\/heads\\/main/);
  assert.match(script, /git', \\['push', '--porcelain', 'origin'/);
  assert.match(script, /candidateParentSha|parent = git\\(\\['rev-parse', 'HEAD\\^'/);
  assert.match(workflow, /contents:\\s+write/);
  assert.match(workflow, /ref: execution/);
  assert.doesNotMatch(workflow, /create_branch|git switch -c|git checkout -b/);
  assert.match(workflow, /cancel-in-progress: false/);
});
