#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY = 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';
const RETIRED_REPOSITORIES = ['m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS'];

const HISTORICAL_MARKER =
  /HISTORICAL|RETIRED|INVALIDATED|NOT CURRENT(?: CERTIFICATION)?|LAST-VERIFIED-CANDIDATE|SUPERSEDED/iu;

const CURRENT_PLACEHOLDER_FIELDS = [
  ['CURRENT_SHA', 'REQUIRED'],
  ['CURRENT_WORKFLOW_RUN', 'REQUIRED'],
  ['CURRENT_EVIDENCE', 'REQUIRED'],
  ['PRODUCTION_IDENTITY', 'REQUIRED'],
  ['CERTIFIED_SHA', 'NOT_YET_CERTIFIED'],
];

const CERTIFICATION_DOCUMENTS = [
  { path: 'docs/FLIXO-PUBLIC-RELEASE-MANIFEST.md', requireCurrentPlaceholders: true },
  { path: 'docs/FLIXO-FINAL-RELEASE-CERTIFICATION.md', requireCurrentPlaceholders: true },
  { path: 'docs/FLIXO-EXACT-SHA-CERTIFICATION.md', requireCurrentPlaceholders: true },
  { path: 'docs/FLIXO-PUBLIC-LAUNCH-CERTIFICATE-TEMPLATE.md', requireCurrentPlaceholders: true },
  { path: 'docs/RED-TEAM-CERTIFICATION.md', requireCurrentPlaceholders: true },
  { path: 'docs/FLIXO-FINAL-CERTIFICATION-ATTESTATION.md', requireCurrentPlaceholders: true },
  { path: 'docs/FLIXO-PROMPT-01-STATE.md', requireCurrentPlaceholders: false, stateRecord: true },
];

function repoRoot() {
  return resolve(fileURLToPath(new URL('..', import.meta.url)));
}

function normalizeRepositoryIdentity(value) {
  return String(value ?? '')
    .trim()
    .replace(/^git@github\.com:/u, '')
    .replace(/^https?:\/\/github\.com\//u, '')
    .replace(/\.git$/u, '')
    .replace(/^\//u, '');
}

function getObservedRepository() {
  const envRepository = process.env.GITHUB_REPOSITORY;
  if (envRepository) return normalizeRepositoryIdentity(envRepository);

  try {
    const origin = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      cwd: repoRoot(),
      encoding: 'utf8',
    });
    return normalizeRepositoryIdentity(origin);
  } catch {
    return '';
  }
}

function getObservedSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot(),
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}

function splitSections(markdown) {
  const lines = String(markdown).split(/\r?\n/u);
  const sections = [];
  let current = { heading: '(document preamble)', body: [] };

  for (const line of lines) {
    if (/^#{1,6}\s+/u.test(line)) {
      sections.push(current);
      current = { heading: line.trim(), body: [] };
    } else {
      current.body.push(line);
    }
  }
  sections.push(current);

  return sections.filter((section) => section.heading !== '(document preamble)' || section.body.some(Boolean));
}

function isHistoricalSection(section) {
  if (HISTORICAL_MARKER.test(section.heading)) return true;
  const firstLines = section.body.filter((line) => line.trim()).slice(0, 6);
  return firstLines.some((line) =>
    /^(?:STATUS|STATE|EVIDENCE_STATE)\s*[:=]\s*(?:HISTORICAL|RETIRED|INVALIDATED|NOT CURRENT(?: CERTIFICATION)?|LAST-VERIFIED-CANDIDATE|SUPERSEDED)\b/iu.test(
      line.trim(),
    ),
  );
}

function extractHistoricalTokens(sections) {
  const tokens = { sha: new Set(), pr: new Set(), workflow: new Set(), repository: new Set() };

  for (const section of sections) {
    if (!isHistoricalSection(section)) continue;
    const text = [section.heading, ...section.body].join('\n');

    for (const value of text.match(/\b[a-f0-9]{40}\b/giu) ?? []) tokens.sha.add(value.toLowerCase());
    for (const value of text.match(/\bPR\s*#\d+\b/giu) ?? []) tokens.pr.add(value.toUpperCase());

    for (const value of text.match(/\b(?:workflow\s+)?run\s+#?\d+\b/giu) ?? []) {
      tokens.workflow.add(value.toLowerCase().replace(/\s+/gu, ' '));
    }

    for (const value of text.match(/(?:^|\n)\s*(?:REPOSITORY|Repository)\s*:\s*[^\s]+\/[^\s]+/gu) ?? []) {
      const match = value.match(/(?:REPOSITORY|Repository)\s*:\s*([^\s]+)/iu);
      if (match?.[1]) tokens.repository.add(normalizeRepositoryIdentity(match[1]));
    }
  }

  return tokens;
}

function currentSectionsText(sections) {
  return sections
    .filter((section) => !isHistoricalSection(section))
    .map((section) => [section.heading, ...section.body].join('\n'))
    .join('\n');
}

function validateDocument({ path, content, requireCurrentPlaceholders, stateRecord = false }) {
  const errors = [];
  const sections = splitSections(content);
  const currentText = currentSectionsText(sections);
  const historical = extractHistoricalTokens(sections);

  const repoMatches = currentText.match(/(?:^|\n)\s*(?:REPOSITORY|Repository)\s*:\s*[^\s]+\/[^\s]+/gu) ?? [];
  for (const line of repoMatches) {
    const match = line.match(/(?:REPOSITORY|Repository)\s*:\s*([^\s]+)/iu);
    if (match?.[1] && normalizeRepositoryIdentity(match[1]) !== REPOSITORY) {
      errors.push(path + ': non-historical section presents retired/foreign repository identity: ' + match[1]);
    }
  }

  for (const retiredRepository of RETIRED_REPOSITORIES) {
    if (currentText.includes(retiredRepository)) {
      errors.push(path + ': retired repository identity appears outside an explicit historical section: ' + retiredRepository);
    }
  }

  for (const sha of currentText.match(/\b[a-f0-9]{40}\b/giu) ?? []) {
    if (historical.sha.has(sha.toLowerCase())) {
      errors.push(path + ': historical SHA leaks into a current section: ' + sha);
    } else {
      errors.push(path + ': current section embeds a candidate-specific SHA; current records must use fail-closed placeholders until exact evidence exists: ' + sha);
    }
  }

  for (const pr of currentText.match(/\bPR\s*#\d+\b/giu) ?? []) {
    errors.push(path + ': PR identity appears in a current certification/state section: ' + pr);
  }

  for (const workflow of currentText.match(/\b(?:workflow\s+)?run\s+#?\d+\b/giu) ?? []) {
    errors.push(path + ': workflow-run identity appears without historical quarantine: ' + workflow);
  }

  for (const field of currentText.match(/(?:CURRENT_WORKFLOW_RUN|WORKFLOW_RUN)\s*[:=]\s*[^\n]+/giu) ?? []) {
    if (!/(?:REQUIRED|NOT_YET_VERIFIED|NOT_APPLICABLE)\s*$/iu.test(field)) {
      errors.push(path + ': current workflow-run identity is populated and therefore cannot be treated as a placeholder: ' + field.trim());
    }
  }

  for (const productionId of currentText.match(/(?:PRODUCTION_DEPLOYMENT_ID|Production deployment ID|PRODUCTION_IDENTITY)\s*[:=]\s*([^\n]+)/gu) ?? []) {
    if (!/(?:REQUIRED|NOT_YET_VERIFIED|NOT_APPLICABLE)/iu.test(productionId)) {
      errors.push(path + ': current production identity is populated without an exact-SHA evidence contract: ' + productionId.trim());
    }
  }

  const certificationClaims = currentText.match(
    /(?:^|\n)\s*(?:STATUS|CERTIFICATION|RELEASE|RED_TEAM|PROMOTION)\s*[:=][^\n]*(?:PASS\b|CERTIFIED\b|RELEASE VERIFIED)/giu,
  ) ?? [];
  for (const claim of certificationClaims) {
    if (!/(?:NOT\s+READY|NOT\s+CERTIFIED)\b/iu.test(claim)) {
      errors.push(path + ': current certification claim must be backed by a complete exact-SHA record, but this document is not allowed to self-certify: ' + claim.trim());
    }
  }

  for (const pr of historical.pr) {
    if (currentText.toUpperCase().includes(pr)) {
      errors.push(path + ': historical PR reference is reused in a current section: ' + pr);
    }
  }

  for (const workflow of historical.workflow) {
    if (currentText.toLowerCase().includes(workflow)) {
      errors.push(path + ': historical workflow-run reference is reused in a current section: ' + workflow);
    }
  }

  if (requireCurrentPlaceholders) {
    for (const [field, expected] of CURRENT_PLACEHOLDER_FIELDS) {
      const pattern = new RegExp('^\\s*' + field + '\\s*[:=]\\s*' + expected + '\\s*$', 'imu');
      if (!pattern.test(currentText)) {
        errors.push(path + ': missing fail-closed current identity placeholder ' + field + '=' + expected);
      }
    }

    if (!/(?:STATUS\s*[:=]\s*NOT READY|Status:\s*NOT CERTIFIED)/iu.test(currentText)) {
      errors.push(path + ': current certification document must remain explicitly NOT READY/NOT CERTIFIED until exact evidence exists');
    }
  } else if (stateRecord) {
    if (!/(?:STATUS|Status)\s*[:=][^\n]*(?:NOT READY|INVALIDATED|LAST-VERIFIED-CANDIDATE|BLOCKED)/iu.test(currentText)) {
      errors.push(path + ': state record must remain an explicitly non-certifying state');
    }
  }

  return { errors, sections, historical };
}

function runRepositoryChecks() {
  const root = repoRoot();
  const observedRepository = getObservedRepository();
  const observedSha = getObservedSha();
  const errors = [];

  if (observedRepository !== REPOSITORY) {
    errors.push('Repository identity mismatch: expected ' + REPOSITORY + ', observed ' + (observedRepository || 'UNKNOWN'));
  }
  if (!/^[a-f0-9]{40}$/u.test(observedSha)) {
    errors.push('Current HEAD SHA is unavailable or malformed: ' + (observedSha || 'UNKNOWN'));
  }

  for (const document of CERTIFICATION_DOCUMENTS) {
    const absolute = resolve(root, document.path);
    if (!existsSync(absolute)) {
      errors.push('Missing certification-lineage document: ' + document.path);
      continue;
    }
    const content = readFileSync(absolute, 'utf8');
    const result = validateDocument({ ...document, content });
    errors.push(...result.errors);
  }

  if (errors.length) {
    console.error('CERTIFICATION_LINEAGE=FAIL');
    for (const error of errors) console.error(' - ' + error);
    process.exitCode = 1;
    return false;
  }

  console.log('CERTIFICATION_LINEAGE=PASS');
  console.log('REPOSITORY=' + REPOSITORY);
  console.log('CURRENT_HEAD_SHA=' + observedSha);
  console.log('CURRENT_CERTIFICATION_STATE=NOT_READY_UNTIL_EXACT_EVIDENCE_EXISTS');
  return true;
}

function runSelfTests() {
  const historicalSha = '0123456789abcdef0123456789abcdef01234567';
  const good = [
    '# Fixture',
    'STATUS: NOT READY',
    'REPOSITORY: ' + REPOSITORY,
    'CURRENT_SHA=REQUIRED',
    'CURRENT_WORKFLOW_RUN=REQUIRED',
    'CURRENT_EVIDENCE=REQUIRED',
    'PRODUCTION_IDENTITY=REQUIRED',
    'CERTIFIED_SHA=NOT_YET_CERTIFIED',
    '## HISTORICAL / INVALIDATED',
    'STATUS=HISTORICAL — NOT CURRENT CERTIFICATION',
    'REPOSITORY: ' + RETIRED_REPOSITORIES[0],
    'PR #923',
    'workflow run 123456789',
    'SHA: ' + historicalSha,
  ].join('\n');

  const goodResult = validateDocument({
    path: 'fixture.md',
    content: good,
    requireCurrentPlaceholders: true,
  });
  assert.deepEqual(goodResult.errors, []);

  const bad = [
    '# Fixture',
    'STATUS: NOT READY',
    'REPOSITORY: ' + RETIRED_REPOSITORIES[0],
    'CURRENT_SHA=' + historicalSha,
    'CURRENT_WORKFLOW_RUN=123456789',
    'CURRENT_EVIDENCE=REQUIRED',
    'PRODUCTION_IDENTITY=REQUIRED',
    'CERTIFIED_SHA=NOT_YET_CERTIFIED',
    'PR #923',
    '## HISTORICAL',
    'STATUS=HISTORICAL',
  ].join('\n');

  const badResult = validateDocument({
    path: 'fixture.md',
    content: bad,
    requireCurrentPlaceholders: true,
  });
  assert.ok(badResult.errors.some((value) => value.includes('retired repository identity')));
  assert.ok(badResult.errors.some((value) => value.includes('candidate-specific SHA')));
  assert.ok(badResult.errors.some((value) => value.includes('PR identity')));
  assert.ok(badResult.errors.some((value) => value.includes('workflow-run identity')));

  const incompleteCertified = [
    '# Fixture',
    'STATUS: CERTIFIED',
    'REPOSITORY: ' + REPOSITORY,
    'CURRENT_SHA=REQUIRED',
    'CURRENT_WORKFLOW_RUN=REQUIRED',
    'CURRENT_EVIDENCE=REQUIRED',
    'PRODUCTION_IDENTITY=REQUIRED',
    'CERTIFIED_SHA=NOT_YET_CERTIFIED',
  ].join('\n');

  const certResult = validateDocument({
    path: 'fixture.md',
    content: incompleteCertified,
    requireCurrentPlaceholders: true,
  });
  assert.ok(certResult.errors.some((value) => value.includes('must be backed by a complete exact-SHA record')));

  console.log('CERTIFICATION_LINEAGE_SELF_TEST=PASS');
}

if (process.argv.includes('--self-test')) runSelfTests();
if (!process.argv.includes('--self-test-only')) runRepositoryChecks();
