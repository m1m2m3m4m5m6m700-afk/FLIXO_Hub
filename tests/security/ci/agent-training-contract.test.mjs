import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const agents = [
  { name: 'المستكشف AI', registration: '.github/agents/المستكشف-ai.md', training: true },
  { name: 'المستكشف 2', registration: '.github/agents/المستكشف-2.md', training: false },
  { name: 'المطور AI', registration: '.github/agents/المطور-ai.md', training: true },
  { name: 'FLIXO i18n Agent', registration: '.github/agents/flixo-i18n-agent.md', training: true },
  { name: 'FLIXO Repository Maintainer Agent', registration: '.github/agents/flixo-maintainer-agent.md', training: true },
  { name: 'FLIXO QA Agent', registration: '.github/agents/flixo-qa-agent.md', training: true },
  { name: 'Red Team 1', registration: '.github/agents/red-team-1.md', training: false },
  { name: 'Red Team 2', registration: '.github/agents/red-team-2.md', training: false },
];

test('all official agents have explicit identities', () => {
  for (const agent of agents) {
    const content = readFileSync(agent.registration, 'utf8');
    assert.ok(content.includes('name: ' + agent.name));
    assert.ok(content.includes('tools: read, search, terminal'));
    assert.doesNotMatch(content, /git push origin main|force[- ]push|write directly to main/iu);
    assert.doesNotMatch(content, /declare PASS\\/GREEN\\/CERTIFIED|self-certif/iu);
    if (agent.training) assert.match(content, /100\\/100/u);
  }
});

test('role-specific packages expose bounded report paths', () => {
  const checks = [
    ['الوكلاء/المستكشف AI/المستكشف.md', 'الوكلاء/المستكشف AI/تقارير المستكشف/'],
    ['الوكلاء/المستكشف 2/المستكشف-2.md', 'الوكلاء/المستكشف 2/تقارير الاعتراضات/'],
    ['الوكلاء/المطور AI/المطور.md', 'الوكلاء/المطور AI/تقارير التطوير/'],
    ['الوكلاء/Red Team 1/العقد.md', 'الوكلاء/Red Team 1/التقارير/'],
    ['الوكلاء/Red Team 2/العقد.md', 'الوكلاء/Red Team 2/التقارير/'],
  ];
  for (const [file, reportPath] of checks) {
    assert.ok(readFileSync(file, 'utf8').includes(reportPath));
  }
});

test('training program defines evidence-based 100 score and adjudication', () => {
  const readme = readFileSync('الوكلاء/تدريب الوكلاء/README.md', 'utf8');
  const rubric = readFileSync('الوكلاء/تدريب الوكلاء/المعيار-100.md', 'utf8');
  assert.match(readme, /هدف 100\\/100/u);
  assert.match(readme, /لا يُمنح الوكيل تقييم 100\\/100/u);
  assert.match(rubric, /الأدلة/u);
  assert.match(rubric, /CONFIRMED \/ REJECTED \/ DISPUTED \/ UNKNOWN/u);
});

test('package exposes the all-agent training contract as a test gate', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['test:agent-training'], 'node --test tests/security/ci/agent-training-contract.test.mjs');
  assert.match(pkg.scripts.test, /test:agent-training/u);
});
