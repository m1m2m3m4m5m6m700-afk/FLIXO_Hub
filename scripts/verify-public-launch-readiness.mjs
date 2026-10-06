import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = new Set(process.argv.slice(2));
const mode = args.has('--release') ? 'release' : args.has('--template') ? 'template' : null;
if (!mode) { console.error('[launch-readiness] usage: node scripts/verify-public-launch-readiness.mjs --template|--release'); process.exit(2); }

const required = [
  'docs/FLIXO-PUBLIC-LAUNCH-EXECUTION-PLAN.md', 'docs/FLIXO-PUBLIC-RELEASE-MANIFEST.md',
  'docs/FLIXO-LAUNCH-DAY-RUNBOOK.md', 'docs/FLIXO-ANALYTICS-CONTRACT.md',
  'docs/FLIXO-TRUST-AND-OPERATIONS.md', 'docs/FLIXO-LAUNCH-DISTRIBUTION-PACK.md',
  'docs/FLIXO-PUBLIC-CLAIMS-ALLOWLIST.md', 'docs/FLIXO-PUBLIC-LAUNCH-CERTIFICATE-TEMPLATE.md',
  'SECURITY.md', 'CODE_OF_CONDUCT.md', 'CHANGELOG.md',
];
const missing = required.filter((path) => !existsSync(resolve(path)));
if (missing.length) { console.error('[launch-readiness] BLOCKED: missing required files'); missing.forEach((path) => console.error(' - ' + path)); process.exit(1); }

const manifest = readFileSync(resolve('docs/FLIXO-PUBLIC-RELEASE-MANIFEST.md'), 'utf8');
const certificate = readFileSync(resolve('docs/FLIXO-PUBLIC-LAUNCH-CERTIFICATE-TEMPLATE.md'), 'utf8');
const blockers = readFileSync(resolve('docs/FLIXO-LEGAL-LAUNCH-BLOCKERS.md'), 'utf8');
const security = readFileSync(resolve('SECURITY.md'), 'utf8');

if (mode === 'template') {
  console.log('[launch-readiness] TEMPLATE PASS: structure may retain explicit candidate/certification placeholders.');
  console.log('[launch-readiness] TEMPLATE NOTE: --release is required before any release claim.');
  process.exit(0);
}

const failures = [];
if (manifest.includes('Candidate SHA: `REQUIRED`')) failures.push('Candidate SHA is still REQUIRED.');
if (certificate.includes('Status: NOT CERTIFIED')) failures.push('Launch certificate is still NOT CERTIFIED.');
if (!existsSync(resolve('LICENSE'))) failures.push('LICENSE is missing; owner must select and publish a code license.');
if (blockers.includes('No repository code license has been selected')) failures.push('Code license decision is pending.');
if (blockers.includes('real support contact must be configured')) failures.push('Real public support contact is not configured.');
if (blockers.includes('must be enabled and tested')) failures.push('Private security reporting capability is not evidenced as enabled and tested.');
if (!/Reporting a vulnerability/i.test(security)) failures.push('SECURITY.md lacks a vulnerability reporting section.');
if (failures.length) { console.error('[launch-readiness] RELEASE BLOCKED'); failures.forEach((failure) => console.error(' - ' + failure)); process.exit(1); }
console.log('[launch-readiness] RELEASE PASS: release prerequisites are resolved.');