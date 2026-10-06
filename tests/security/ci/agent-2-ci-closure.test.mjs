import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validatePromotionProof } from '../../../scripts/ci/verify-promotion-lineage.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CANONICAL = 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';
const MAIN = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);

function baseProof() {
  return {
    eventName: 'pull_request',
    repository: CANONICAL,
    baseRef: 'main',
    headRef: 'execution',
    baseRepoFullName: CANONICAL,
    headRepoFullName: CANONICAL,
    baseSha: MAIN,
    headSha: HEAD,
    candidateSha: HEAD,
    liveBaseSha: MAIN,
    liveHeadSha: HEAD,
    liveMainSha: MAIN,
    mergeBaseSha: MAIN,
    sourceIdentityCount: 1,
  };
}

test('canonical same-name execution branch is accepted', () => {
  assert.equal(validatePromotionProof(baseProof()).ok, true);
});

test('same-name execution branch from a fork is rejected', () => {
  const proof = baseProof();
  proof.headRepoFullName = 'attacker/FLIXO_Hub';
  const result = validatePromotionProof(proof);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('head-repository:not-canonical'));
});

test('changed head SHA is rejected', () => {
  const proof = baseProof();
  proof.liveHeadSha = 'c'.repeat(40);
  const result = validatePromotionProof(proof);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('head:stale-or-changed'));
});

test('changed base SHA is rejected', () => {
  const proof = baseProof();
  proof.liveBaseSha = 'd'.repeat(40);
  const result = validatePromotionProof(proof);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('base:stale-or-changed'));
});

test('stale merge-base is rejected even when head matches', () => {
  const proof = baseProof();
  proof.mergeBaseSha = 'e'.repeat(40);
  const result = validatePromotionProof(proof);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('merge-base:not-fresh-with-live-main'));
});

test('missing source identity is rejected', () => {
  const proof = baseProof();
  proof.headRepoFullName = '';
  proof.sourceIdentityCount = 0;
  const result = validatePromotionProof(proof);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('source-identity:missing-or-ambiguous'));
});

test('ambiguous source identity is rejected', () => {
  const proof = baseProof();
  proof.sourceIdentityCount = 2;
  const result = validatePromotionProof(proof);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('source-identity:missing-or-ambiguous'));
});

test('unexpected promotion direction is rejected', () => {
  const proof = baseProof();
  proof.headRef = 'feature';
  const result = validatePromotionProof(proof);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('direction:expected-execution-to-main'));
});

test('CI promotion workflow contains live lineage and exact security-gate semantics', async () => {
  const workflow = await readFile(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  for (const token of [
    'GITHUB_EVENT_PATH:', 'verify-promotion-lineage.mjs', 'EXPECTED_SHA:',
    'head_sha=$EXPECTED_SHA', 'event=pull_request', 'FLIXO CodeQL', 'FLIXO Secret Scan',
  ]) assert.ok(workflow.includes(token), 'missing CI token: ' + token);
});

test('TestSprite privileged execution is canonical-source-only', async () => {
  const workflow = await readFile(path.join(ROOT, '.github/workflows/testsprite-execution.yml'), 'utf8');
  assert.ok(workflow.includes("github.repository == 'm1m2m3m4m5m6m700-afk/FLIXO_Hub'"));
  assert.ok(workflow.includes("github.ref == 'refs/heads/execution'"));
  assert.ok(!workflow.includes('pull_request:'), 'privileged TestSprite workflow must not run on PR events');
  const trustIndex = workflow.indexOf('Fail-closed trusted TestSprite execution boundary');
  const secretIndex = workflow.indexOf('TESTSPRITE_API_KEY');
  assert.ok(trustIndex >= 0 && secretIndex > trustIndex, 'trust boundary must precede secret use');
  assert.ok(workflow.includes('ref: ${{ github.sha }}'));
  assert.ok(workflow.includes('test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"'));
});

test('Secret Scan is exact-SHA, full-history, and does not mask findings', async () => {
  const workflow = await readFile(path.join(ROOT, '.github/workflows/secret-scan.yml'), 'utf8');
  assert.ok(workflow.includes('fetch-depth: 0'));
  assert.ok(workflow.includes('SCAN_SHA:'));
  assert.ok(workflow.includes('test "$(git rev-parse HEAD)" = "$SCAN_SHA"'));
  assert.ok(workflow.includes('GITLEAKS_CONFIG: .gitleaks.toml'));
  assert.ok(workflow.includes('GITLEAKS_ENABLE_COMMENTS: "false"'));
  assert.ok(!workflow.includes('|| true'));
  const config = await readFile(path.join(ROOT, '.gitleaks.toml'), 'utf8');
  assert.ok(!config.includes('gitleaksignore'));
});

test('CodeQL persists exact-SHA SARIF as durable evidence when GitHub default setup blocks API uploads', async () => {
  const workflow = await readFile(path.join(ROOT, '.github/workflows/codeql.yml'), 'utf8');
  assert.ok(workflow.includes('upload: never'));
  assert.ok(workflow.includes('codeql-sarif'));
  assert.ok(workflow.includes('sha256sum'));
  assert.ok(workflow.includes('exact-sha.txt'));
  assert.ok(workflow.includes('flixo-codeql-sarif-${{ github.sha }}-${{ matrix.language }}'));
  assert.ok(workflow.includes('retention-days: 90'));
  assert.ok(workflow.includes('actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02'));
  assert.ok(!workflow.includes('wait-for-processing: true'));
});

test('production deployment keeps source immutable and artifact-bound', async () => {
  const workflow = await readFile(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  assert.ok(workflow.includes('RELEASE_SOURCE_PURITY=PASS'));
  assert.ok(workflow.includes('build-provenance.json'));
  assert.ok(workflow.includes('git status --porcelain'));
  assert.ok(!workflow.includes('path.write_text('));
  assert.ok(!workflow.includes("EMBEDDED_DEPLOYMENT_SHA = '$DEPLOYMENT_SHA'"));
  assert.ok(workflow.includes('FLIXO_DEPLOYMENT_SHA:${{ github.sha }}'));
});

async function collectWorkflowFiles(dir, output = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectWorkflowFiles(full, output);
    else if (/\.ya?ml$/u.test(entry.name)) output.push(full);
  }
  return output;
}

test('all external GitHub Actions in workflow files are immutable SHA-pinned', async () => {
  const files = await collectWorkflowFiles(path.join(ROOT, '.github/workflows'));
  assert.ok(files.length > 0);
  const violations = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    for (const [index, line] of content.split('\n').entries()) {
      const match = line.match(/^\s*-?\s*uses:\s*([^\s#]+)/u);
      if (!match) continue;
      const ref = match[1];
      if (ref.startsWith('./')) continue;
      const at = ref.lastIndexOf('@');
      if (at < 1) {
        violations.push(path.relative(ROOT, file) + ':' + (index + 1) + ': missing @commit-sha');
        continue;
      }
      const version = ref.slice(at + 1);
      if (!/^[0-9a-f]{40}$/u.test(version)) violations.push(path.relative(ROOT, file) + ':' + (index + 1) + ': mutable action ref ' + ref);
    }
  }
  assert.deepEqual(violations, [], violations.join('\n'));
});