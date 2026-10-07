import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../../../', import.meta.url);
const readRepo = (relativePath) => readFile(new URL(relativePath, root), 'utf8');

test('Agent-3 PR validation is read-only and publication is isolated', async () => {
  const workflow = await readRepo('.github/workflows/triage-and-clean.yml');
  const pipeline = workflow.split('\n  publish:\n')[0];
  assert.match(pipeline, /permissions:\s*\n\s*contents:\s*read/u);
  assert.doesNotMatch(pipeline, /contents:\s*write/u);
  assert.doesNotMatch(pipeline, /persist-credentials:\s*true/u);
  assert.match(workflow, /\n  publish:\n[\s\S]*contents:\s*write/u);
  assert.match(workflow, /persist-credentials:\s*false/u);
});

test('final Red Team has no pull-request write authority', async () => {
  const workflow = await readRepo('.github/workflows/final-red-team.yml');
  assert.doesNotMatch(workflow, /pull-requests:\s*write/u);
  assert.match(workflow, /persist-credentials:\s*false/u);
  assert.doesNotMatch(workflow.split('\n  jobs:\n')[0] ?? '', /GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/u);
});

test('repository knowledge scan and publication are separated', async () => {
  const workflow = await readRepo('.github/workflows/repository-knowledge.yml');
  const knowledge = workflow.split('\n  publish:\n')[0];
  assert.match(knowledge, /permissions:\s*\n\s*contents:\s*read/u);
  assert.doesNotMatch(knowledge, /permissions:\s*\n\s*contents:\s*write/u);
  assert.match(knowledge, /persist-credentials:\s*false/u);
  assert.match(workflow, /\n  publish:\n[\s\S]*contents:\s*write/u);
});

test('privileged patch controller is pinned to trusted main source', async () => {
  const workflow = await readRepo('.github/workflows/patch-capsule-controller.yml');
  assert.match(workflow, /ref:\s*main/u);
  assert.match(workflow, /persist-credentials:\s*false/u);
  assert.match(workflow, /FLIXO_TRUSTED_SOURCE_REF:\s*main/u);

  const controller = await readRepo('scripts/ci/controller-reconcile-and-publish.mjs');
  assert.match(controller, /CONTROLLER_TRUSTED_SOURCE_REF_REQUIRED/u);
  assert.match(controller, /sanitizedWorktreeEnv/u);
  assert.match(controller, /npm.*--ignore-scripts/u);
  assert.match(controller, /GIT_CONFIG_KEY_0/u);
});

test('human gate does not persist a write credential in repository config', async () => {
  const workflow = await readRepo('.github/workflows/human-gate.yml');
  assert.match(workflow, /persist-credentials:\s*false/u);
  assert.match(workflow, /http\.https:\/\/github\.com\/\.extraheader=u);
});

test('main promotion requires an independent approval on the exact head', async () => {
  const workflow = await readRepo('.github/workflows/ci.yml');
  assert.match(workflow, /pull-requests:\s*read/u);
  assert.match(workflow, /Require independent current-head approval for main promotion/u);
  assert.match(workflow, /verify-current-pr-approval\.mjs/u);

  const verifier = await readRepo('scripts/ci/verify-current-pr-approval.mjs');
  assert.match(verifier, /review\.state === 'APPROVED'/u);
  assert.match(verifier, /review\.commit_id === expectedSha/u);
  assert.match(verifier, /review\.user\.login !== prAuthor/u);
});

test('tool discovery does not expose ready-but-non-executable capabilities', async () => {
  const page = await readRepo('src/routes/tools-page.tsx');
  assert.match(page, /TOOL_CATALOG\.ready\.filter\(\(tool\) => tool\.capability\.state === 'EXECUTABLE'\)/u);
});
