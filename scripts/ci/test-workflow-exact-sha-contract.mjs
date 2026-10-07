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
  const expectedRedTeamGroup = "  group: flixo-final-red-team-${{ github.event_name }}-${{ github.event.pull_request.number || github.ref_name }}";
  assert.ok(
    workflow.includes(expectedRedTeamGroup),
    'final Red Team concurrency must deduplicate promotion PR runs by PR identity',
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

  assert.match(
    workflow,
    /group:\s*flixo-ci-\$\{\{ github\.event_name \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref_name \}\}/u,
    'CI concurrency must be stable within an event lane',
  );
  assert.doesNotMatch(
    workflow,
    /group:[^\n]*\$\{\{ github\.sha \}\}/u,
    'CI concurrency group must not include commit SHA',
  );

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

test('execution-only assurance lanes deduplicate by branch while promotion lanes retain PR identity', async () => {
  const redTeam = await readFile(new URL('../../.github/workflows/final-red-team.yml', import.meta.url), 'utf8');
  const video = await readFile(new URL('../../.github/workflows/video-assurance.yml', import.meta.url), 'utf8');

  assert.match(redTeam, /group:\s*flixo-final-red-team-\$\{\{ github\.event_name \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref_name \}\}/u);
  assert.match(video, /group:\s*flixo-video-assurance-\$\{\{ github\.event_name \}\}-\$\{\{ github\.ref_name \}\}/u);
  assert.match(redTeam, /cancel-in-progress:\s*true/u);
  assert.match(video, /cancel-in-progress: true/u);
});

test('canonical CI security workflows do not trigger on execution worker PRs', async () => {
  const files = [
    '.github/workflows/ci.yml',
    '.github/workflows/codeql.yml',
    '.github/workflows/secret-scan.yml',
  ];

  for (const path of files) {
    const workflow = await readFile(new URL('../../' + path, import.meta.url), 'utf8');
    assert.doesNotMatch(workflow, /pull_request:\s*\n\s*branches:\s*\[main, execution\]/u);
    assert.match(workflow, /pull_request:\s*\n\s*branches:\s*\[main\]/u);
  }
});

test('worker pull requests are filtered out of canonical release jobs', async () => {
  const files = [
    '.github/workflows/ci.yml',
    '.github/workflows/codeql.yml',
    '.github/workflows/secret-scan.yml',
    '.github/workflows/final-red-team.yml',
  ];

  for (const path of files) {
    const workflow = await readFile(new URL('../../' + path, import.meta.url), 'utf8');
    assert.match(
      workflow,
      /if:\s*\$\{\{ github\.event_name != 'pull_request' \|\| \(github\.event\.pull_request\.head\.ref == 'execution' && github\.event\.pull_request\.head\.repo\.full_name == github\.repository\) \}\}/u,
      path + ' must gate PR jobs to the canonical execution branch',
    );
  }
});

test('final Red Team security wait is promotion-only after execution security deduplication', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/final-red-team.yml', import.meta.url), 'utf8');
  const marker = '      - name: Wait for exact-SHA security workflows on promotion PRs';
  const index = workflow.indexOf(marker);
  assert.ok(index >= 0, 'final Red Team security wait must exist');
  const next = workflow.indexOf('      - name:', index + marker.length);
  const block = workflow.slice(index, next > 0 ? next : workflow.length);
  assert.match(
    block,
    /if:\s*github\.event_name == 'pull_request' && github\.event\.pull_request\.base\.ref == 'main'/u,
  );
  assert.match(block, /event=push/u);
  assert.match(block, /FLIXO CodeQL/u);
  assert.match(block, /FLIXO Secret Scan/u);
});

test('promotion lineage checkout retains full history for merge-base verification', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const marker = '      - name: Verify exact head identity and live promotion lineage';
  const markerIndex = workflow.indexOf(marker);
  assert.ok(markerIndex >= 0, 'promotion lineage verification step must exist');
  const checkoutIndex = workflow.lastIndexOf('      - uses: actions/checkout@', markerIndex);
  assert.ok(checkoutIndex >= 0, 'promotion lineage checkout must exist');
  const checkoutBlock = workflow.slice(checkoutIndex, markerIndex);
  assert.match(checkoutBlock, /fetch-depth: 0/u);
});

test('execution push branch-policy checkout never persists Git credentials', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');

  const marker = '      - name: Validate branch policy for the current ref';
  const markerIndex = workflow.indexOf(marker);
  assert.ok(markerIndex >= 0, 'branch-policy validation step must exist');

  const checkoutStart = workflow.lastIndexOf('      - uses: actions/checkout@', markerIndex);
  assert.ok(checkoutStart >= 0, 'branch-policy checkout must exist');

  const checkoutBlock = workflow.slice(checkoutStart, markerIndex);
  assert.match(checkoutBlock, /persist-credentials:\s*false\b/u);
  assert.doesNotMatch(checkoutBlock, /persist-credentials:\s*true\b/u);
});

test('human gate execution code cannot inherit persisted Git credentials', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/human-gate.yml', import.meta.url), 'utf8');

  assert.match(workflow, /ref:\s*execution/u);
  assert.match(workflow, /persist-credentials:\s*false\b/u);
  assert.doesNotMatch(workflow, /persist-credentials:\s*true\b/u);

  const publishMarker = '      - name: Publish human gate transition to execution';
  const publishIndex = workflow.indexOf(publishMarker);
  assert.ok(publishIndex >= 0, 'human gate publish step must exist');
  const publishBlock = workflow.slice(publishIndex);
  assert.match(publishBlock, /GITHUB_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/u);
  assert.match(publishBlock, /http\.extraheader=AUTHORIZATION: bearer \$GITHUB_TOKEN/u);
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
    workflow.includes('          DEPLOYMENT_SHA: ${{ github.sha }}'),
    'production identity must be bound to the immutable main SHA',
  );
  assert.ok(
    workflow.includes('          test "$(git rev-parse HEAD)" = "$DEPLOYMENT_SHA"'),
    'production checkout must verify repository HEAD against DEPLOYMENT_SHA',
  );
  assert.ok(workflow.includes('git rev-parse HEAD'), 'production deployment must inspect the checked-out commit SHA');
  assert.ok(workflow.includes('$DEPLOYMENT_SHA'), 'production deployment must retain immutable SHA binding');
});
