import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';
const read = (p) => readFileSync(resolve(p), 'utf8');
const manifest = read('docs/FLIXO-PUBLIC-RELEASE-MANIFEST.md');
const redTeam = read('docs/RED-TEAM-CERTIFICATION.md');
const finalCert = read('docs/FLIXO-FINAL-RELEASE-CERTIFICATION.md');
const launchTemplate = read('docs/FLIXO-PUBLIC-LAUNCH-CERTIFICATE-TEMPLATE.md');
const exact = read('docs/FLIXO-EXACT-SHA-CERTIFICATION.md');
const prompt01 = read('docs/FLIXO-PROMPT-01-STATE.md');
const failures = [];

for (const [name, source] of [['manifest', manifest], ['final-certification', finalCert], ['launch-template', launchTemplate], ['exact-sha', exact]]) {
  if (!source.includes(repo)) failures.push(name + ': current repository identity is missing');
  if (source.includes('m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS')) failures.push(name + ': retired repository name appears in an active document');
  if (/Integration PR:\s*#923/u.test(source)) failures.push(name + ': historical PR #923 is presented as current');
}
if (!redTeam.includes('Status: HISTORICAL — NOT CURRENT CERTIFICATION')) failures.push('red-team record is not explicitly historical');
if (!finalCert.includes('Historical integration PR: #923 — HISTORICAL ONLY')) failures.push('final certification record lacks historical PR quarantine');
if (!exact.includes('Historical integration PR: #923 — HISTORICAL ONLY')) failures.push('exact-SHA record lacks historical PR quarantine');
if (!manifest.includes('Candidate SHA: `REQUIRED`')) failures.push('release manifest contains a non-placeholder candidate SHA');
if (!manifest.includes('Candidate branch: `REQUIRED`')) failures.push('release manifest contains a stale candidate branch');
for (const sha of ['b3dd497f354a54434938582128e9ae45e2e94067','9d38d896d52514a916c3c5d7ed3244ae8db3a601']) {
  if (new RegExp('Candidate SHA:.*' + sha, 'u').test(manifest)) failures.push('manifest still treats stale SHA as candidate: ' + sha);
}
if (!prompt01.includes('STATUS: HISTORICAL — NOT CURRENT EXACT-SHA EVIDENCE')) failures.push('Prompt 01 stale PASS record is not quarantined as historical');

if (failures.length) {
  console.error('[certification-lineage] BLOCKED');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}
console.log('[certification-lineage] PASS');