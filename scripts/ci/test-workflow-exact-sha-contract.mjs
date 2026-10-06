import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const EXACT_HEAD_SELECTOR = "github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha";
const EXACT_HEAD_EXPRESSION = '${{ ' + EXACT_HEAD_SELECTOR + ' }}';

test('candidate diagnostics stay bound to the exact PR head SHA', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/final-red-team.yml', import.meta.url), 'utf8');
  const secretScan = await readFile(new URL('../../.github/workflows/secret-scan.yml', import.meta.url), 'utf8');

  assert.ok(
    workflow.includes('    EXPECTED_SHA: ' + EXACT_HEAD_EXPRESSION),
    'final Red Team diagnostics must use the PR head SHA selector',
  );
  assert.ok(
    workflow.includes('          name: flixo-final-red-team-' + EXACT_HEAD_EXPRESSION),
    'final Red Team artifact identity must use the PR head SHA selector',
  );
  assert.ok(
    workflow.includes('          ref: ' + EXACT_HEAD_EXPRESSION),
    'final Red Team checkout must use the PR head SHA selector',
  );
  assert.ok(
    !workflow.includes('    EXPECTED_SHA: ${{ github.sha }}'),
    'bare github.sha must not label PR-head diagnostics',
  );
  assert.ok(
    workflow.includes('  group: flixo-final-red-team-' + EXACT_HEAD_EXPRESSION),
    'final Red Team concurrency identity must use the exact PR head SHA selector',
  );
  assert.ok(
    !workflow.includes('          name: flixo-final-red-team-${{ github.sha }}'),
    'bare github.sha must not label PR-head artifacts',
  );
  assert.ok(
    secretScan.includes('          ref: ' + EXACT_HEAD_EXPRESSION),
    'secret scanning must checkout the exact PR head',
  );
  assert.ok(
    secretScan.includes('          fetch-depth: 0'),
    'secret scanning must retain full history for gitleaks',
  );
});

test('FLIXO CI protects every candidate-sensitive checkout and identity stamp', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');

  const exactRefCount = workflow.split('          ref: ' + EXACT_HEAD_EXPRESSION).length - 1;
  assert.equal(exactRefCount, 6, 'all six candidate-sensitive CI checkouts must use the exact PR head SHA');

  assert.ok(
    workflow.includes('          BUILD_SHA: ' + EXACT_HEAD_EXPRESSION),
    'build identity must derive from the exact candidate SHA',
  );
  assert.ok(
    workflow.includes('      EXPECTED_SHA: ' + EXACT_HEAD_EXPRESSION),
    'candidate jobs must derive EXPECTED_SHA from the exact candidate SHA',
  );
});

test('promotion and production gates remain fail-closed and exact-SHA bound', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');

  assert.ok(workflow.includes('needs: [trust-gate]'), 'promotion proof must depend on trust-gate');
  assert.ok(
    workflow.includes('if: ${{ always() }}'),
    'promotion proof must still execute as a fail-closed assertion when upstream fails',
  );
  assert.ok(
    workflow.includes("if: github.event_name == 'push' && github.ref == 'refs/heads/main'"),
    'production deployment must remain main-push only',
  );
  assert.ok(
    workflow.includes('          ref: ${{ github.sha }}'),
    'post-merge production deployment must checkout the immutable main SHA',
  );
  assert.ok(
    workflow.includes("DEPLOYMENT_SHA: ${{ github.sha }}"),
    'production identity must be bound to the immutable main SHA',
  );
  assert.ok(
    workflow.includes('          test "$(git rev-parse HEAD)" = "$DEPLOYMENT_SHA"'),
    'production checkout must verify repository HEAD against DEPLOYMENT_SHA',
  );
  assert.ok(workflow.includes('git rev-parse HEAD'), 'production deployment must inspect the checked-out commit SHA');
  assert.ok(workflow.includes('$DEPLOYMENT_SHA'), 'production deployment must retain immutable SHA binding');
});
