import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Prompt 17 exact-SHA diagnostics stay bound to the candidate head', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/final-red-team.yml', import.meta.url), 'utf8');
  const secretScan = await readFile(new URL('../../.github/workflows/secret-scan.yml', import.meta.url), 'utf8');
  assert.ok(workflow.includes("    EXPECTED_SHA: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}"), 'diagnostics must use the PR head SHA selector');
  assert.ok(workflow.includes("          name: flixo-final-red-team-${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}"), 'artifact identity must use the PR head SHA selector');
  assert.ok(!workflow.includes("    EXPECTED_SHA: ${{ github.sha }}"), 'bare github.sha must not label PR-head diagnostics');
  assert.ok(!workflow.includes("          name: flixo-final-red-team-${{ github.sha }}"), 'bare github.sha must not label PR-head artifacts');
  assert.ok(secretScan.includes("          ref: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}"), 'secret scanning must checkout the exact PR head');
  assert.ok(secretScan.includes('          fetch-depth: 0'), 'secret scanning must retain full history for gitleaks');
});
