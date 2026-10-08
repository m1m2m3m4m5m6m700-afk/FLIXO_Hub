import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { evaluateAdmission } from '../../scripts/ci/admission-gate.mjs';

test('admission gate is fail-closed and execution-scoped', () => {
  const base = {
    repository: 'm1m2m3m4m5m6m700-afk/FLIXO_Hub',
    targetSha: '0123456789abcdef0123456789abcdef01234567',
    missionId: 'MISSION-1',
    policyVersion: '1.4.1',
    scope: 'EXECUTION',
  };
  assert.equal(evaluateAdmission(base).allow, true);
  assert.equal(evaluateAdmission({ ...base, repository: 'attacker/repo' }).allow, false);
  assert.equal(evaluateAdmission({ ...base, targetSha: 'deadbeef' }).allow, false);
  assert.equal(evaluateAdmission({ ...base, scope: 'MERGE' }).allow, false);
  assert.equal(
    evaluateAdmission({ ...base, workflowRun: { headSha: 'fedcba9876543210fedcba9876543210fedcba98' } }).allow,
    false,
  );
});

test('admission workflow is read-only, manual, exact-SHA, and invokes canonical governance', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/agent-governance-admission.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /contents:s*read/u);
  assert.doesNotMatch(workflow, /contents:s*write/u);
  assert.match(workflow, /ref: ${{ inputs.target_sha }}/u);
  assert.match(workflow, /git rev-parse HEAD.*TARGET_SHA|test "$(git rev-parse HEAD)" = "$TARGET_SHA"/su);
  assert.match(workflow, /scripts/ci/check-governance.sh/u);
  assert.match(workflow, /POLICY_VERSION:s*"1.4.1"/u);
  assert.match(workflow, /scope:s*EXECUTION/u);
  assert.match(workflow, /upload-artifact/u);
  assert.doesNotMatch(workflow, /pull_request:/u);
  assert.doesNotMatch(workflow, /push:/u);
});
