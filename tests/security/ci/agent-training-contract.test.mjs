import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const agents = [
  {name:'المستكشف المعرفي AI',registration:'.github/agents/المستكشف-ai.md',technicalName:'المستكشف AI',scout:false},
  {name:'المطور الهندسي AI',registration:'.github/agents/المطور-ai.md',technicalName:'المطور AI',scout:false},
  {name:'مُعرّب المنصة AI',registration:'.github/agents/flixo-i18n-agent.md',technicalName:'FLIXO i18n Agent',scout:false},
  {name:'حارس المستودع AI',registration:'.github/agents/flixo-maintainer-agent.md',technicalName:'FLIXO Repository Maintainer Agent',scout:false},
  {name:'ضابط الجودة AI',registration:'.github/agents/flixo-qa-agent.md',technicalName:'FLIXO QA Agent',scout:false},
  {name:'المهاجم الأمني AI',registration:'.github/agents/red-team-1.md',technicalName:'Red Team 1',scout:false},
  {name:'المُفنّد المضاد AI',registration:'.github/agents/red-team-2.md',technicalName:'Red Team 2',scout:false},
  {name:'مستكشف العمارة AI',registration:'.github/agents/flixo-scout-architecture.agent.md',technicalName:'FLIXO Architecture Scout',scout:true},
  {name:'مستكشف التقنية AI',registration:'.github/agents/flixo-scout-technology.agent.md',technicalName:'FLIXO Technology Scout',scout:true},
  {name:'مستكشف النظام البيئي AI',registration:'.github/agents/flixo-scout-ecosystem.agent.md',technicalName:'FLIXO Ecosystem Scout',scout:true},
  {name:'مصمم تجربة المنتج AI',registration:'.github/agents/flixo-product-experience-agent.md',technicalName:'مصمم تجربة المنتج AI',scout:false},
  {name:'منفذ الإصلاح AI',registration:'.github/agents/flixo-execution-repair-agent.md',technicalName:'منفذ الإصلاح AI',scout:false},
  {name:'ضابط ضمان الإصدار AI',registration:'.github/agents/flixo-release-assurance-agent.md',technicalName:'ضابط ضمان الإصدار AI',scout:false},
  {name:'حارس الموثوقية والأداء AI',registration:'.github/agents/flixo-reliability-performance-agent.md',technicalName:'حارس الموثوقية والأداء AI',scout:false},
];

test('all ten principal training agents have explicit identities', () => {
  for (const agent of agents) {
    const content = readFileSync(agent.registration, 'utf8');
    assert.ok(content.includes('name: ' + agent.technicalName));
    assert.ok(content.includes('display_name: ' + agent.name));
    if (agent.scout) assert.ok(content.includes('tools: ["read", "search", "edit"]'));
    else assert.ok(content.includes('tools: read, search, terminal'));
    assert.doesNotMatch(content, /git push origin main|force[- ]push|write directly to main/iu);
    assert.doesNotMatch(content, /(?:^|\n)\s*(?:the agent|agent)\s+(?:can|may|will|shall)\s+(?:declare\s+)?(?:PASS|GREEN|CERTIFIED)|(?:^|\n)\s*(?:the agent|agent)\s+(?:can|may|will|shall)\s+(?:certify|self-certify)\b/imu);
    assert.match(content, /100\/100/u);
  }
});

test('core role-specific packages expose bounded report paths', () => {
  const checks = [
    ['الوكلاء AI/المستكشف AI/المستكشف.md', 'الوكلاء AI/المستكشف AI/تقارير المستكشف/'],
    ['الوكلاء AI/المستكشف 2/المستكشف-2.md', 'الوكلاء AI/المستكشف 2/تقارير الاعتراضات/'],
    ['الوكلاء AI/المطور AI/المطور.md', 'الوكلاء AI/المطور AI/تقارير التطوير/'],
    ['الوكلاء AI/Red Team 1/العقد.md', 'الوكلاء AI/Red Team 1/التقارير/'],
    ['الوكلاء AI/Red Team 2/العقد.md', 'الوكلاء AI/Red Team 2/التقارير/'],
  ];
  for (const [file, reportPath] of checks) {
    assert.ok(readFileSync(file, 'utf8').includes(reportPath));
  }
});

test('training program defines evidence-based 100 score and adjudication', () => {
  const readme = readFileSync('الوكلاء AI/تدريب الوكلاء AI/README.md', 'utf8');
  const rubric = readFileSync('الوكلاء AI/تدريب الوكلاء AI/المعيار-100.md', 'utf8');
  assert.match(readme, /هدف 100\/100/u);
  assert.match(readme, /لا يُمنح الوكيل تقييم 100\/100/u);
  assert.match(rubric, /الأدلة/u);
  assert.match(rubric, /CONFIRMED \/ REJECTED \/ DISPUTED \/ UNKNOWN/u);
});

test('package exposes the all-agent training contract as a test gate', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['test:agent-training'], 'node --test tests/security/ci/agent-training-contract.test.mjs tests/security/ci/agent-canonical-registry.test.mjs tests/security/ci/agent-self-learning-control-plane.test.mjs tests/security/ci/agent-role-drills.test.mjs tests/security/ci/agent-readiness-evaluator.test.mjs');
  assert.match(pkg.scripts.test, /test:agent-training/u);
});

test('agent training includes exact-SHA learning and lesson promotion checks', async () => {
  const learner = await import('../../../scripts/agent-learning/self-learning-control-plane.mjs');
  const sha = '0000000000000000000000000000000000000001';
  const stale = '0000000000000000000000000000000000000002';
  const result = learner.scoreSubmission({
    agent: 'المستكشف AI', drill: 'repository-knowledge', exactSha: sha, evidence: ['e'], unknowns: [],
    nextActions: ['n'], coveragePercent: 100, dependencies: [], semanticDiff: []
  }, stale);
  assert.equal(result.passed, false);
  assert.equal(learner.evaluateLessonPromotion({
    testedSha: sha, evidence: ['e'], review: { decision: 'CONFIRMED' }, repeatPasses: 2, regressionTest: true
  }, sha).status, 'PROMOTED');
});

test('all core training agents have canonical package contracts', () => {
  const packages = [
    'الوكلاء AI/i18n Agent/العقد.md',
    'الوكلاء AI/Maintainer Agent/العقد.md',
    'الوكلاء AI/QA Agent/العقد.md','الوكلاء AI/مصمم تجربة المنتج AI/العقد.md','الوكلاء AI/منفذ الإصلاح AI/العقد.md','الوكلاء AI/ضابط ضمان الإصدار AI/العقد.md','الوكلاء AI/حارس الموثوقية والأداء AI/العقد.md',
  ];
  for (const path of packages) {
    const content = readFileSync(path, 'utf8');
    assert.match(content, /100\/100/u);
    assert.match(content, /Exact-SHA|exact-SHA/iu);
  }
});
test('all three Scout contracts preserve research-only role requirements', () => {
  for (const path of [
    '.github/agents/flixo-scout-architecture.agent.md',
    '.github/agents/flixo-scout-technology.agent.md',
    '.github/agents/flixo-scout-ecosystem.agent.md',
  ]) {
    const content = readFileSync(path, 'utf8');
    assert.match(content, /tools: ["read", "search", "edit"]/u);
    assert.match(content, /Proposal Schema v4/u);
    assert.match(content, /only writable repository path is .agent-intelligence\/inbox\//u);
    assert.match(content, /never.*(?:PASS|GREEN|CERTIFIED|EXECUTE)/isu);
    assert.match(content, /rollback/u);
  }
});
