import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../../..');

function pathResolve(relative) {
  return `${root}/${relative}`;
}

// The gate script hardcodes docs/MODEL_LICENSE_MANIFEST.json, so to test
// alternate manifests we mutate the real file and restore it in finally.
function withManifestOverrides(content, fn) {
  const manifestPath = pathResolve('docs/MODEL_LICENSE_MANIFEST.json');
  const original = readFileSync(manifestPath, 'utf8');
  try {
    writeFileSync(manifestPath, content, 'utf8');
    fn();
  } finally {
    writeFileSync(manifestPath, original, 'utf8');
  }
}

// Runs the gate script and returns { status, stdout, stderr }. Common to
// the negative and --require-entry tests below.
function launchGate(args) {
  const result = spawnSync(process.execPath, [pathResolve('scripts/model-license-gate.mjs'), ...args], {
    encoding: 'utf8',
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

test('model-license-gate: manifest schema_version is semver-compliant', () => {
  const manifestPath = pathResolve('docs/MODEL_LICENSE_MANIFEST.json');
  assert.ok(existsSync(manifestPath), 'manifest file must exist');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const semverRe = /^\d+\.\d+\.\d+$/;
  assert.ok(semverRe.test(String(manifest.schema_version)), 'schema_version must be semver');
});

test('model-license-gate: fail-closed policy requires human approval', () => {
  const manifestPath = pathResolve('docs/MODEL_LICENSE_MANIFEST.json');
  const policyPath = pathResolve('docs/MODEL-LICENSE-POLICY.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'));

  // Fail-closed: zero entries admitted is the expected state before evidence.
  assert.equal(manifest.entries.length, 0, 'no production model may be admitted without evidence');

  // License classes define the permitted elements. Default is prohibited.
  assert.equal(policy.license_classes.prohibited_by_default.length, 3, 'default-to-prohibited classes defined');
  assert.ok(policy.license_classes.approved_for_initial_review.length > 0, 'approved license classes defined');
  assert.ok(policy.license_classes.review_required.length > 0, 'review-required classes defined');

  // License classes define review channels: initial review only for approved classes.
  assert.ok(
    policy.license_classes.approved_for_initial_review.includes('MIT'),
    'MIT is an explicitly-approved license class',
  );
  assert.ok(
    policy.license_classes.review_required.includes('openrail++'),
    'openrail++ requires review, not initial approval',
  );
});

test('model-license-gate: policy gate gate rules (fields actually consumed by the gate script)', () => {
  const policyPath = pathResolve('docs/MODEL-LICENSE-POLICY.json');
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'));

  // The gate script checks these exact policy fields.
  assert.ok(policy.license_classes?.approved_for_initial_review, 'approved_for_initial_review is required');
  assert.ok(policy.license_classes?.prohibited_by_default, 'prohibited_by_default is required');
  assert.ok(policy.production_rule, 'production_rule is required');
  assert.ok(policy.gate_outcomes?.includes('PASS'), 'PASS outcome defined');
  assert.ok(policy.gate_outcomes?.includes('REVIEW_REQUIRED'), 'REVIEW_REQUIRED outcome defined');
  assert.ok(policy.gate_outcomes?.includes('BLOCKED'), 'BLOCKED outcome defined');
  assert.ok(policy.gate_outcomes?.includes('UNKNOWN'), 'UNKNOWN outcome defined');
  assert.ok(policy.candidate_catalog_reference, 'candidate_catalog_reference is required');
  assert.ok(policy.candidate_catalog_rule, 'candidate_catalog_rule is required');
});

test('model-license-gate: evidence artifacts referenced by policy exist on disk', () => {
  const policyPath = pathResolve('docs/MODEL-LICENSE-POLICY.json');
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'));

  for (const p of policy.license_text_paths || []) {
    assert.ok(existsSync(p), `license text path must exist: ${p}`);
  }
  for (const p of policy.model_terms_path ? [policy.model_terms_path] : []) {
    assert.ok(existsSync(p), `model terms path must exist: ${p}`);
  }
  for (const p of policy.security_evidence_path || []) {
    assert.ok(existsSync(p), `security evidence path must exist: ${p}`);
  }
  for (const p of policy.evaluation_evidence_path || []) {
    assert.ok(existsSync(p), `evaluation evidence path must exist: ${p}`);
  }
});

test('model-license-gate: gate script exits zero', () => {
  execFileSync(process.execPath, [pathResolve('scripts/model-license-gate.mjs')], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
});
test('model-license-gate: download_date must be YYYY-MM-DD at the script level', () => {
  const manifestPath = pathResolve('docs/MODEL_LICENSE_MANIFEST.json');
  const original = readFileSync(manifestPath);
  const bad = JSON.parse(original);
  bad.entries = [
    {
      model: 'demo',
      version: '0.1.0',
      provider: 'unit',
      deployment_mode: 'local',
      supported_tasks: ['text'],
      source: 'https://example.test/license.md',
      license: 'MIT',
      license_file: 'https://example.test/LICENSE',
      artifact_sha256: 'a'.repeat(64),
      download_date: '0000-00-00',
      commercial_use: false,
      fine_tuning: false,
      redistribution: false,
      distillation: false,
      adapter_policy: 'default',
      acceptable_use_policy: 'https://example.test/AUP',
      trademark_restrictions: 'none',
      training_data_restrictions: 'none',
      provenance_status: 'KNOWN',
      FLIXO_owned_layer: false,
      fallback_models: [],
      review_status: 'BLOCKED',
      lifecycle_status: 'CANDIDATE',
    },
  ];
  withManifestOverrides(`${JSON.stringify(bad, null, 2)}\n`, () => {
    const r = spawnSync(process.execPath, [pathResolve('scripts/model-license-gate.mjs')], {
      encoding: 'utf8',
    });
    assert.equal(r.status, 1, 'invalid download_date must exit non-zero');
    assert.match(r.stderr, /download_date/i, 'error must name the date field');
  });
});

test('model-license-gate: --require-entry accepts a single evidenced model', () => {
  const manifestPath = pathResolve('docs/MODEL_LICENSE_MANIFEST.json');
  const original = readFileSync(manifestPath);
  const single = JSON.parse(original);
  single.entries = [
    {
      model: 'demo',
      version: '0.1.0',
      provider: 'unit',
      deployment_mode: 'local',
      supported_tasks: ['text'],
      source: 'https://example.test/license.md',
      license: 'MIT',
      license_file: 'https://example.test/LICENSE',
      artifact_sha256: 'a'.repeat(64),
      download_date: '2026-10-13',
      commercial_use: false,
      fine_tuning: false,
      redistribution: false,
      distillation: false,
      adapter_policy: 'default',
      acceptable_use_policy: 'https://example.test/AUP',
      trademark_restrictions: 'none',
      training_data_restrictions: 'none',
      provenance_status: 'KNOWN',
      FLIXO_owned_layer: false,
      fallback_models: [],
      review_status: 'PASS',
      lifecycle_status: 'ACTIVE',
    },
  ];
  withManifestOverrides(`${JSON.stringify(single, null, 2)}\n`, () => {
    const result = launchGate(['--require-entry']);
    assert.equal(result.status, 0, '--require-entry with one evidenced model must pass');
    assert.match(result.stdout, /PASS/, 'gate must print PASS');
  });
});

test('model-license-gate: --require-entry blocks an empty model list', () => {
  const manifestPath = pathResolve('docs/MODEL_LICENSE_MANIFEST.json');
  const original = readFileSync(manifestPath);
  const empty = JSON.parse(original);
  empty.entries = [];
  withManifestOverrides(`${JSON.stringify(empty, null, 2)}\n`, () => {
    const result = launchGate(['--require-entry']);
    assert.equal(result.status, 1, '--require-entry with no models must exit non-zero');
    assert.match(result.stderr, /BLOCKED/i, 'error must be a BLOCKED decision');
    assert.match(result.stderr, /at least one evidenced model/i, 'reason must name the admission requirement');
  });
});
