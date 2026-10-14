import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../../..');

function pathResolve(relative) {
  return `${root}/${relative}`;
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

  // Fail-closed controls remain mandatory even after a model is eventually admitted.
  assert.equal(manifest.rules?.unknown_is_production_blocked, true, 'unknown models must remain blocked');
  assert.equal(manifest.rules?.latest_version_allowed, false, 'latest-version selection must remain disabled');
  assert.equal(manifest.rules?.automatic_promotion_allowed, false, 'promotion must remain manual');
  assert.equal(manifest.rules?.automatic_license_acceptance_allowed, false, 'license acceptance must remain manual');

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
  const result = execFileSync(process.execPath, [pathResolve('scripts/model-license-gate.mjs')], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.match(result, /PASS/);
});

test('model-license-gate: date validator accepts YYYY-MM-DD and rejects malformed dates', () => {
  const script = readFileSync(pathResolve('scripts/model-license-gate.mjs'), 'utf8');
  const validator = script.match(/!\/(.*?)\/u\.test\(entry\.download_date\)/);
  assert.ok(validator, 'download_date validator must be present in the gate script');
  const datePattern = new RegExp(validator[1], 'u');
  assert.equal(datePattern.test('2026-10-13'), true, 'valid ISO date must pass');
  assert.equal(datePattern.test('2026-1-13'), false, 'non-padded month must fail');
});

test('model-license-gate: release admission fails closed with an empty manifest', () => {
  const manifest = JSON.parse(readFileSync(pathResolve('docs/MODEL_LICENSE_MANIFEST.json'), 'utf8'));
  const result = spawnSync(process.execPath, [pathResolve('scripts/model-license-gate.mjs'), '--require-entry'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.error, undefined, 'release gate process must start');
  if (manifest.entries.length === 0) {
    assert.equal(result.status, 1, 'release mode must reject an empty manifest');
    assert.match(result.stderr, /no model is registered; release admission requires at least one evidenced model/i);
  } else {
    assert.equal(result.status, 0, 'release mode must pass only when all registered entries are admissible');
  }
});
