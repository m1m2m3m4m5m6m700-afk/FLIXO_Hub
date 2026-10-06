import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = new Set(process.argv.slice(2));
const mode = args.has('--release') ? 'release' : args.has('--template') ? 'template' : null;
if (!mode) {
  console.error('[launch-readiness] usage: node scripts/verify-public-launch-readiness.mjs --template|--release');
  process.exit(2);
}

const required = [
  'docs/FLIXO-PUBLIC-LAUNCH-EXECUTION-PLAN.md',
  'docs/FLIXO-PUBLIC-RELEASE-MANIFEST.md',
  'docs/FLIXO-LAUNCH-DAY-RUNBOOK.md',
  'docs/FLIXO-ANALYTICS-CONTRACT.md',
  'docs/FLIXO-TRUST-AND-OPERATIONS.md',
  'docs/FLIXO-LAUNCH-DISTRIBUTION-PACK.md',
  'docs/FLIXO-PUBLIC-CLAIMS-ALLOWLIST.md',
  'docs/FLIXO-PUBLIC-LAUNCH-CERTIFICATE-TEMPLATE.md',
  'docs/FLIXO-LEGAL-LAUNCH-BLOCKERS.md',
  'SECURITY.md',
  'CODE_OF_CONDUCT.md',
  'CHANGELOG.md',
];

const missing = required.filter((file) => !existsSync(resolve(file)));
if (missing.length) {
  console.error('[launch-readiness] BLOCKED: missing required files');
  missing.forEach((file) => console.error(' - ' + file));
  process.exit(1);
}

const manifest = readFileSync(resolve('docs/FLIXO-PUBLIC-RELEASE-MANIFEST.md'), 'utf8');
const certificate = readFileSync(resolve('docs/FLIXO-PUBLIC-LAUNCH-CERTIFICATE-TEMPLATE.md'), 'utf8');
const blockers = readFileSync(resolve('docs/FLIXO-LEGAL-LAUNCH-BLOCKERS.md'), 'utf8');
const security = readFileSync(resolve('SECURITY.md'), 'utf8');

if (mode === 'template') {
  console.log('[launch-readiness] TEMPLATE PASS: structure may retain explicit candidate/certification placeholders.');
  console.log('[launch-readiness] TEMPLATE NOTE: --release is required for a release decision.');
  process.exit(0);
}

const failures = [];
if (/Candidate SHA:\s*[^\n]*\b(?:REQUIRED|PENDING)\b/i.test(manifest)) failures.push('Candidate SHA is unresolved.');
if (/Status:\s*NOT CERTIFIED/i.test(certificate)) failures.push('Launch certificate status is NOT CERTIFIED.');
if (!existsSync(resolve('LICENSE'))) failures.push('LICENSE is missing; no code license has been selected/published.');
if (/Public support contact[\s\S]{0,300}\b(?:PENDING_OWNER_DECISION|must be configured|Never publish a fabricated)/i.test(blockers)) {
  failures.push('Public support contact is unresolved.');
}
if (/Private security reporting[\s\S]{0,350}\b(?:PENDING_OWNER_DECISION|must be enabled and tested)/i.test(blockers)) {
  failures.push('Private security reporting is unresolved.');
}
if (!/## Reporting a vulnerability/i.test(security)) failures.push('SECURITY.md lacks a vulnerability-reporting section.');
if (/Owner decision:\s*PENDING/i.test(blockers)) failures.push('One or more launch blocker owner decisions remain pending.');

if (failures.length) {
  console.error('[launch-readiness] RELEASE BLOCKED');
  failures.forEach((failure) => console.error(' - ' + failure));
  process.exit(1);
}

console.log('[launch-readiness] RELEASE PASS: required release prerequisites are resolved.');
