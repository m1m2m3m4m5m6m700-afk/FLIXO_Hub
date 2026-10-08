import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { evaluateAdmission } from '../../scripts/ci/admission-gate.mjs';

// Governance contract invariant: tests must import without executing the gate.

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
  assert.ok(workflow.includes('workflow_dispatch:'));
  assert.ok(workflow.includes('contents: read'));
  assert.ok(!workflow.includes('contents: write'));
  assert.ok(workflow.includes('ref: ${{ inputs.target_sha }}'));
  assert.ok(workflow.includes('test "$(git rev-parse HEAD)" = "$TARGET_SHA"'));
  assert.ok(workflow.includes('scripts/ci/check-governance.sh'));
  assert.ok(workflow.includes('POLICY_VERSION: "1.4.1"'));
  const gateSource = await readFile(new URL('../../scripts/ci/admission-gate.mjs', import.meta.url), 'utf8');
  assert.ok(gateSource.includes("scope: 'EXECUTION'"));
  assert.ok(gateSource.includes("ALLOW_EXECUTION"));
  assert.ok(workflow.includes('git fetch origin execution'));
  assert.ok(workflow.includes('test "$(git rev-parse origin/execution)" = "$TARGET_SHA"'));
  assert.ok(workflow.includes('upload-artifact'));
  assert.ok(workflow.includes('GH_TOKEN: ${{ github.token }}'));
  assert.ok(workflow.includes('GITHUB_REPOSITORY: ${{ github.repository }}'));
  assert.ok(!workflow.includes('pull_request:'));
  assert.ok(!workflow.includes('push:'));
});
