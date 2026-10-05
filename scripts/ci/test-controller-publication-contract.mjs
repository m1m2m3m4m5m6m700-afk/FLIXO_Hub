import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
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
  assert.ok(script.includes("function createCandidateCommit"));
  assert.ok(script.includes("p_reconciled_candidate_sha: candidateSha"));
  assert.ok(script.includes("p_decision: 'ACCEPTED'"));
  assert.ok(script.includes("flix_controller_push_queue_controller_decide"));
  assert.ok(script.includes("ALREADY_PUBLISHED_RECOVERY"));
  assert.ok(workflow.includes('contents: write'));
  assert.ok(workflow.includes('ref: execution'));
  assert.ok(!workflow.includes('create_branch'));
  assert.ok(!workflow.includes('git switch -c'));
  assert.ok(!workflow.includes('git checkout -b'));
  assert.ok(workflow.includes('cancel-in-progress: false'));
  assert.ok(workflow.includes('PENDING_CONTROLLER_REVIEW,CONTROLLER_REVIEWING,STALE,CONFLICT,ACCEPTED'));
});


test('controller recovery state contract remains recoverable after ACCEPTED', async () => {
  const migrationNames = await readdir(new URL('../../supabase/migrations/', import.meta.url));
  const recoveryName = migrationNames.find((name) => name.endsWith('_patch_capsule_publication_recovery.sql'));
  const nullFixName = migrationNames.find((name) => name.endsWith('_patch_capsule_validation_null_fix.sql'));
  assert.ok(recoveryName, 'publication recovery migration must exist');
  assert.ok(nullFixName, 'validation null-fix migration must exist');
  const recovery = await readFile(new URL('../../supabase/migrations/' + recoveryName, import.meta.url), 'utf8');
  const nullFix = await readFile(new URL('../../supabase/migrations/' + nullFixName, import.meta.url), 'utf8');
  assert.ok(recovery.includes("'CONFLICT','ACCEPTED'"));
  assert.ok(recovery.includes("candidate_sha=p_consolidated_commit_sha"));
  assert.ok(recovery.includes("p_current_sha=p_consolidated_commit_sha"));
  assert.ok(recovery.includes("status='ACCEPTED'"));
  assert.ok(nullFix.includes("jsonb_typeof(current_report -> 'decision') <> 'null'"));
});
