import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  classifyPath,
  classifyTaskSignal,
  extractImports,
  extractSymbols,
  isGeneratedKnowledgeArtifact,
  resolveLocalImport,
  collectGitRefSnapshot,
} from '../../../scripts/repository-knowledge-scan.mjs';

const repoRoot = process.cwd();
const profilePath = 'الوكلاء/وكيل-معرفة-المستودع/الوكيل.md';
const registrationProfilePath = '.github/agents/flixo-repository-knowledge-agent.md';
const scannerPath = 'scripts/repository-knowledge-scan.mjs';
const workflowPath = '.github/workflows/repository-knowledge.yml';
const reportDir = 'الوكلاء/وكيل-معرفة-المستودع/التقارير';

test('knowledge agent profile declares bounded read-only mission', () => {
  const profile = readFileSync(profilePath, 'utf8');
  const registrationProfile = readFileSync(registrationProfilePath, 'utf8');

  assert.match(profile, /report_path: 0\(التقارير\)\//);
  assert.match(profile, /READ-ONLY reconnaissance and knowledge agent/);
  assert.match(profile, /must never invent missing information/);
  assert.match(profile, /CAN_COMPLETE/);
  assert.match(profile, /CAN_COMPLETE_WITH_LIMITATIONS/);
  assert.match(profile, /must not.*update.*المهام\.md/s);
  assert.match(profile, /must not.*merge or deploy/s);
  assert.match(profile, /must not.*declare PASS\/GREEN\/CERTIFIED/s);
  assert.doesNotMatch(profile, /reports\/repository-knowledge\//);
  assert.equal(registrationProfile, profile);
});

test('symbol extraction distinguishes exported and local declarations', () => {
  const source = [
    'export interface User {',
    '  id: string;',
    '}',
    'export function loadUser() {',
    '  return null;',
    '}',
    'const localValue = 42;',
  ].join('\n');

  const symbols = extractSymbols('src/example.ts', source);
  assert.deepEqual(symbols, [
    { name: 'User', kind: 'interface', line: 1, exported: true },
    { name: 'loadUser', kind: 'function', line: 4, exported: true },
    { name: 'localValue', kind: 'variable', line: 7, exported: false },
  ]);
});

test('import extraction and local resolution produce dependency edges', () => {
  const source = [
    "import { helper } from './helper';",
    "import React from 'react';",
    "export { thing } from './thing.js';",
  ].join('\n');

  const imports = extractImports('src/main.ts', source);
  assert.deepEqual(imports, [
    { specifier: './helper', line: 1 },
    { specifier: 'react', line: 2 },
    { specifier: './thing.js', line: 3 },
  ]);

  const files = new Set(['src/helper.ts', 'src/thing.js', 'src/main.ts']);
  assert.equal(resolveLocalImport('src/main.ts', './helper', files), 'src/helper.ts');
  assert.equal(resolveLocalImport('src/main.ts', './thing.js', files), 'src/thing.js');
  assert.equal(resolveLocalImport('src/main.ts', 'react', files), null);
});

test('generated reports are inventoried but excluded from recursive semantic analysis', () => {
  assert.equal(isGeneratedKnowledgeArtifact('0(التقارير)/abc.md'), true);
  assert.equal(isGeneratedKnowledgeArtifact('src/example.ts'), false);
  assert.equal(classifyPath('0(التقارير)/abc.md'), 'generated-knowledge-artifact');
  assert.equal(classifyPath('src/example.ts'), 'runtime');
});

test('task discovery is classified rather than converted into executable tasks', () => {
  assert.equal(classifyTaskSignal('TODO: inspect stale contract'), 'genuine-plan-task-candidate');
  assert.equal(classifyTaskSignal('This contract is required.'), 'policy-or-contract-candidate');
  assert.equal(classifyTaskSignal('This file is deprecated.'), 'stale-or-historical-candidate');
  assert.equal(classifyTaskSignal('Remaining work is pending.'), 'future-work-candidate');
});

test('knowledge agent is explicitly allowed to read main without mutation authority', () => {
  const profile = readFileSync(profilePath, 'utf8');
  assert.match(profile, /# Main branch read scope/);
  assert.match(profile, /explicitly authorized to read.*main/s);
  assert.match(profile, /Reading.*main.*read-only reconnaissance/s);
});

test('scanner exposes a read-only main branch snapshot', () => {
  const snapshot = collectGitRefSnapshot();
  assert.match(snapshot.sha ?? '', /^[0-9a-f]{40}$/);
  assert.equal(snapshot.readable, true);
  assert.ok(snapshot.trackedFiles > 0);
  assert.ok(snapshot.textFiles > 0);
});

test('scanner passes syntax validation', () => {
  execFileSync(process.execPath, ['--check', scannerPath], { cwd: repoRoot, stdio: 'pipe' });
});

test('scanner produces an exact-SHA report with zero uncovered authored lines', () => {
  const output = execFileSync(process.execPath, [scannerPath, '--verify'], {
    cwd: repoRoot,
    env: { ...process.env },
    encoding: 'utf8',
  });
  const result = JSON.parse(output);

  assert.match(result.sha, /^[0-9a-f]{40}$/);
  assert.equal(result.uncoveredSourceLines, 0);
  const normalizedReportPath = result.reportPath.replace(repoRoot + '/', '');
  assert.equal(normalizedReportPath, reportDir + '/' + result.sha + '.md');
  assert.ok(result.trackedFiles > 0);
  assert.ok(result.sourceTextFiles > 0);
  assert.ok(result.symbolCount > 0);
  assert.ok(result.dependencyEdgeCount > 0);
  assert.ok(result.taskSignals >= 0);
  assert.equal(result.status, result.unknownSourceLines > 0 || result.unresolvedLocalImports > 0 ? 'CAN_COMPLETE_WITH_LIMITATIONS' : 'CAN_COMPLETE');
  assert.ok(existsSync(result.reportPath));

  const report = readFileSync(result.reportPath, 'utf8');
  assert.match(report, new RegExp('Exact SHA: ' + result.sha));
  assert.match(report, /## Main branch read snapshot/);
  assert.match(report, /Main SHA:/);
  assert.match(report, /## Dependency graph/);
  assert.match(report, /## Symbol index/);
  assert.match(report, /## Change delta/);
  assert.match(report, /## Capability boundary/);
  assert.match(report, /Uncovered repository-authored text lines: 0/);
  assert.match(report, /Generated knowledge artifacts/);
});

test('workflow wakes on execution changes and ignores only its own report directory', () => {
  const workflow = readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /branches: \[execution\]/);
  assert.match(workflow, /paths-ignore:/);
  assert.match(workflow, /الوكلاء\/وكيل-معرفة-المستودع\/التقارير\/\*\*/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /persist-credentials: true/);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$\{GITHUB_SHA\}"/);
  assert.match(workflow, /Uncovered repository-authored text lines: 0/);
  assert.match(workflow, /git fetch origin execution/);
  assert.match(workflow, /git add 'الوكلاء\/وكيل-معرفة-المستودع\/التقارير\//);
  assert.doesNotMatch(workflow, /reports\/repository-knowledge/);
});

test('scanner does not re-ingest legacy English report directory', () => {
  const scanner = readFileSync(scannerPath, 'utf8');
  assert.doesNotMatch(scanner, /reports\/repository-knowledge/);
  assert.match(scanner, /الوكلاء\/وكيل-معرفة-المستودع\/التقارير/);
});
