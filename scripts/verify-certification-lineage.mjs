import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CURRENT_REPOSITORY = 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';
const RETIRED_REPOSITORY = 'm1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS';
const ACTIVE_DOCS = [
  'docs/FLIXO-PUBLIC-RELEASE-MANIFEST.md',
  'docs/FLIXO-FINAL-RELEASE-CERTIFICATION.md',
  'docs/FLIXO-EXACT-SHA-CERTIFICATION.md',
  'docs/FLIXO-PUBLIC-LAUNCH-CERTIFICATE-TEMPLATE.md',
];
const RECORD_DOCS = [
  'docs/RED-TEAM-CERTIFICATION.md',
  'docs/FLIXO-PROMPT-01-STATE.md',
];
const STALE_IDENTIFIERS = [
  'a44958a97126b2e050746010947aef2cfa286729',
  '7d9266a42690417511d0202b3d06b6b362f2d7d4',
  '52413f0f610c34cc988ecfc523134247c6cae135',
  'b3dd497f354a54434938582128e9ae45e2e94067',
  '9d38d896d52514a916c3c5d7ed3244ae8db3a601',
];
const HISTORICAL_MARKER = /HISTORICAL|RETIRED|INVALIDATED|LAST-VERIFIED-CANDIDATE|NOT CURRENT/u;
const CURRENT_CLAIM = /^(CURRENT_|CANDIDATE_|CERTIFIED_|TESTED_|BUILT_|BROWSER_VERIFIED_|SECURITY_VERIFIED_|COVERAGE_VERIFIED_|DEPLOYED_|Candidate SHA:|Candidate branch:|Integration PR:|Production immutable identity:)/u;

const read = (path) => readFileSync(resolve(path), 'utf8');

for (const path of [...ACTIVE_DOCS, ...RECORD_DOCS]) {
  const source = read(path);
  if (!source.includes(CURRENT_REPOSITORY)) {
    throw new Error(`LINEAGE_REPOSITORY_MISSING=${path}`);
  }

  const lines = source.split(/\r?\n/u);
  for (const line of lines) {
    if (line.includes(RETIRED_REPOSITORY) && !HISTORICAL_MARKER.test(line)) {
      throw new Error(`LINEAGE_RETIRED_REPOSITORY_ACTIVE=${path}:${line.trim()}`);
    }
    const staleIdentifier = STALE_IDENTIFIERS.find((identifier) => line.includes(identifier));
    if (staleIdentifier && CURRENT_CLAIM.test(line) && !HISTORICAL_MARKER.test(line)) {
      throw new Error(`LINEAGE_STALE_IDENTIFIER_ACTIVE=${path}:${line.trim()}`);
    }
    if (/\bPR #923\b/u.test(line) && !HISTORICAL_MARKER.test(line)) {
      throw new Error(`LINEAGE_RETIRED_PR_ACTIVE=${path}:${line.trim()}`);
    }
  }
}

const manifest = read(ACTIVE_DOCS[0]);
if (!manifest.includes('Candidate SHA: `REQUIRED`')) throw new Error('LINEAGE_MANIFEST_SHA_NOT_RESET');
if (!manifest.includes('Candidate branch: `REQUIRED`')) throw new Error('LINEAGE_MANIFEST_BRANCH_NOT_RESET');
if (!manifest.includes('CURRENT_WORKFLOW_RUN: `REQUIRED`')) throw new Error('LINEAGE_MANIFEST_RUN_NOT_BOUND');
if (!manifest.includes('CURRENT_EVIDENCE: `REQUIRED`')) throw new Error('LINEAGE_MANIFEST_EVIDENCE_NOT_BOUND');
if (!manifest.includes('PRODUCTION_IDENTITY: `REQUIRED`')) throw new Error('LINEAGE_MANIFEST_PRODUCTION_ID_NOT_BOUND');

const redTeam = read(RECORD_DOCS[0]);
if (!redTeam.includes('STATUS: HISTORICAL — NOT CURRENT CERTIFICATION')) {
  throw new Error('LINEAGE_RED_TEAM_RECORD_NOT_HISTORICAL');
}

const finalCert = read(ACTIVE_DOCS[1]);
if (!finalCert.includes('STATUS: NOT READY')) throw new Error('LINEAGE_FINAL_CERT_STATUS_INVALID');
if (!finalCert.includes('CURRENT_SHA: `REQUIRED`')) throw new Error('LINEAGE_FINAL_CERT_SHA_NOT_BOUND');
if (!finalCert.includes('CURRENT_WORKFLOW_RUN: `REQUIRED`')) throw new Error('LINEAGE_FINAL_CERT_RUN_NOT_BOUND');

const exact = read(ACTIVE_DOCS[2]);
if (!exact.includes('STATUS: NOT READY')) throw new Error('LINEAGE_EXACT_CERT_STATUS_INVALID');
if (!exact.includes('CURRENT_SHA: `REQUIRED`')) throw new Error('LINEAGE_EXACT_CERT_SHA_NOT_BOUND');

const prompt01 = read(RECORD_DOCS[1]);
if (!prompt01.includes('STATUS: HISTORICAL — NOT CURRENT EXACT-SHA EVIDENCE')) {
  throw new Error('LINEAGE_PROMPT01_NOT_HISTORICAL');
}

console.log(`CERTIFICATION_LINEAGE_PASS=${ACTIVE_DOCS.length + RECORD_DOCS.length}`);
