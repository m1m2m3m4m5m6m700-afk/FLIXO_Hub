import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'docs', 'MODEL_LICENSE_MANIFEST.json');
const policyPath = path.join(root, 'docs', 'MODEL-LICENSE-POLICY.json');
const requireEntry = process.argv.includes('--require-entry');
const allowModelFreeRelease = process.argv.includes('--allow-model-free-release');
const releaseProfilePath = path.join(root, 'docs', 'INITIAL-RELEASE-PROFILE.json');

const fail = (message) => {
  console.error('[model-license-gate] BLOCKED:', message);
  process.exitCode = 1;
};

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`cannot read valid JSON: ${path.relative(root, file)}`);
    throw error;
  }
}

const manifest = readJson(manifestPath);
const policy = readJson(policyPath);
if (allowModelFreeRelease) {
  const releaseProfile = readJson(releaseProfilePath);
  if (releaseProfile?.schema_version !== '1.0.0') fail('model-free release profile schema_version must be 1.0.0.');
  if (releaseProfile?.status !== 'APPROVED_BY_PRODUCT_OWNER') fail('model-free release profile lacks product-owner decision status.');
  if (releaseProfile?.release_mode !== 'MODEL_FREE_INITIAL_RELEASE') fail('release profile must explicitly select MODEL_FREE_INITIAL_RELEASE.');
  if (releaseProfile?.model_runtime !== 'DISABLED') fail('model-free release requires model_runtime DISABLED.');
  if (releaseProfile?.model_admission_required !== false) fail('model-free release profile must set model_admission_required=false.');
  if (releaseProfile?.external_inference !== false) fail('model-free release must disable external inference.');
  if (releaseProfile?.model_dependent_features !== 'DISABLED') fail('model-dependent features must be disabled for the initial release.');
  if (!Array.isArray(releaseProfile?.included_surface) || releaseProfile.included_surface.length === 0) fail('model-free release must define its included product surface.');
  if (!Array.isArray(releaseProfile?.excluded_capabilities) || !releaseProfile.excluded_capabilities.includes('LLM inference') || !releaseProfile.excluded_capabilities.includes('remote model inference')) fail('model-free release must explicitly exclude inference capabilities.');
  if (!Array.isArray(releaseProfile?.security_constraints) || releaseProfile.security_constraints.length < 4) fail('model-free release security constraints are incomplete.');
  if (manifest.entries.length !== 0) fail('model-free initial release profile conflicts with a non-empty production model manifest.');
}

if (!['1.0.0','1.1.0'].includes(manifest?.schema_version)) fail('unsupported manifest schema.');
if (manifest?.status !== 'ACTIVE') fail('manifest status must be ACTIVE.');
if (manifest?.authority !== 'FLIXO_CONTROL_PLANE') fail('manifest authority is not FLIXO_CONTROL_PLANE.');
if (manifest?.rules?.latest_version_allowed !== false) fail('latest-version selection must remain disabled.');
if (manifest?.rules?.automatic_promotion_allowed !== false) fail('automatic promotion must remain disabled.');
if (manifest?.rules?.automatic_license_acceptance_allowed !== false) fail('automatic license acceptance must remain disabled.');
if (!Array.isArray(manifest?.entries)) fail('entries must be an array.');
if (!Array.isArray(policy?.license_classes?.approved_for_initial_review)) fail('policy approved license classes are missing.');

const required = new Set(manifest.required_fields ?? []);
const statuses = new Set(manifest.review_status_values ?? []);
const seen = new Set();

for (const [index, entry] of manifest.entries.entries()) {
  if (!entry || typeof entry !== 'object') { fail(`entry[${index}] is not an object.`); continue; }
  for (const field of required) {
    if (!(field in entry)) fail(`entry[${index}] is missing ${field}.`);
  }
  if (typeof entry.model !== 'string' || !entry.model.trim()) fail(`entry[${index}] model is empty.`);
  if (typeof entry.source !== 'string' || !/^https:\/\//u.test(entry.source)) fail(`entry[${index}] source must be HTTPS.`);
  if (typeof entry.license_file !== 'string' || !entry.license_file.trim()) fail(`entry[${index}] license_file is empty.`);
  if (typeof entry.download_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(entry.download_date)) fail(`entry[${index}] download_date must be YYYY-MM-DD.`);
  const approvedLicenses = new Set(policy.license_classes.approved_for_initial_review);
  const prohibitedLicenses = new Set(policy.license_classes.prohibited_by_default);
  if (prohibitedLicenses.has(entry.license)) fail(`entry[${index}] uses a prohibited license class.`);
  if (!approvedLicenses.has(entry.license)) fail(`entry[${index}] uses a license requiring explicit review.`);
  if (typeof entry.version !== 'string' || !entry.version.trim()) fail(`entry[${index}] version is empty.`);
  const identity = `${entry.model}@${entry.version}`;
  if (seen.has(identity)) fail(`duplicate model identity: ${identity}`);
  seen.add(identity);
  if (!statuses.has(entry.review_status)) fail(`entry[${index}] has invalid review_status.`);
  if (entry.review_status !== 'PASS') fail(`entry[${index}] is not production-admissible: ${identity}`);
  if (typeof entry.lifecycle_status !== 'string') fail(`entry[${index}] lifecycle_status is required.`);
  if (entry.lifecycle_status && !['CANDIDATE','APPROVED','ACTIVE','QUARANTINED'].includes(entry.lifecycle_status)) {
    fail(`entry[${index}] has invalid lifecycle_status.`);
  }
  if (!/^[a-f0-9]{64}$/iu.test(String(entry.artifact_sha256 ?? ''))) fail(`entry[${index}] artifact_sha256 is not a 64-hex SHA-256.`);
  if (!Array.isArray(entry.fallback_models)) fail(`entry[${index}] fallback_models must be an array.`);
  if (entry.fallback_models.includes(identity)) fail(`entry[${index}] cannot fallback to itself.`);
  if (entry.review_status === 'PASS' && entry.lifecycle_status !== 'ACTIVE') fail(`entry[${index}] PASS entry must be ACTIVE.`);
}

if (requireEntry && manifest.entries.length === 0) fail('no model is registered; release admission requires at least one evidenced model.');
if (requireEntry && allowModelFreeRelease) fail('choose either strict model admission or the explicit model-free initial release profile, not both.');

if (process.exitCode) process.exit(1);
if (allowModelFreeRelease) {
  console.log('[model-license-gate] PASS: explicit MODEL_FREE_INITIAL_RELEASE profile validated; no model is admitted or implied.');
  console.log('[model-license-gate] SCOPE: model runtime, external inference, and model-dependent features are disabled for the initial release.');
} else {
  console.log(`[model-license-gate] PASS: manifest structure and fail-closed policy verified; entries=${manifest.entries.length}`);
  if (manifest.entries.length === 0) console.log('[model-license-gate] NOTE: no production model is admitted; strict model-backed release remains blocked.');
}
