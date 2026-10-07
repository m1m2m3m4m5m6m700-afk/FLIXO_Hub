import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DECISIONS,
  buildExperience,
  evaluateLessonPromotion,
  reconcileLesson,
  scoreSubmission,
} from '../../../scripts/agent-learning/self-learning-control-plane.mjs';

const SHA = '0000000000000000000000000000000000000001';
const OTHER_SHA = '0000000000000000000000000000000000000002';

test('the harness rejects evidence from a different SHA', () => {
  const result = scoreSubmission({
    agent: 'fixture',
    drill: 'repository-knowledge',
    exactSha: SHA,
    evidence: ['file:line'],
    unknowns: [],
    nextActions: ['recheck'],
    coveragePercent: 100,
    dependencies: ['route->registry'],
    semanticDiff: ['changed'],
  }, OTHER_SHA);
  assert.equal(result.passed, false);
  assert.ok(result.failures.includes('exactSha must equal currentSha'));
  assert.equal(result.behavioralEvidence, 'UNPROVEN');
});

test('a complete repository-knowledge drill reaches 100', () => {
  const result = scoreSubmission({
    agent: 'المستكشف AI',
    drill: 'repository-knowledge',
    exactSha: SHA,
    evidence: ['report.md:L10-L20'],
    unknowns: [],
    nextActions: ['publish'],
    coveragePercent: 100,
    dependencies: ['route->registry'],
    semanticDiff: ['added symbol'],
    authorityChain: ['registry','gate','executor','verifier'],
    mainSha: OTHER_SHA,
  }, SHA);
  assert.equal(result.score, 100);
  assert.equal(result.passed, true);
});

test('a lesson stays candidate until independent confirmation, repeats, and regression exist', () => {
  const candidate = buildExperience({
    id: 'exp-001',
    agent: 'المستكشف AI',
    exactSha: SHA,
    drill: 'repository-knowledge',
    result: 'failure',
    evidence: ['report.md:L10-L20'],
    lesson: 're-read the current SHA before deriving evidence',
  });
  assert.equal(evaluateLessonPromotion(candidate, SHA).status, 'CANDIDATE');
  candidate.review = { decision: 'CONFIRMED', evidence: ['independent-report'] };
  candidate.repeatPasses = 2;
  candidate.regressionTest = true;
  assert.equal(evaluateLessonPromotion(candidate, SHA).status, 'PROMOTED');
});

test('lesson evidence becomes stale after the execution SHA changes', () => {
  const candidate = buildExperience({
    id: 'exp-002',
    agent: 'FLIXO QA Agent',
    exactSha: SHA,
    drill: 'verification',
    result: 'pass',
    evidence: ['ci-run'],
  });
  const reconciled = reconcileLesson(candidate, OTHER_SHA);
  assert.equal(reconciled.status, 'STALE_EVIDENCE');
});

test('knowledge that changes repository authority can never be promoted', () => {
  const candidate = buildExperience({
    id: 'exp-003',
    agent: 'Red Team 1',
    exactSha: SHA,
    drill: 'independent-challenge',
    result: 'finding',
    evidence: ['record'],
    review: { decision: 'CONFIRMED' },
    repeatPasses: 2,
    regressionTest: true,
  });
  candidate.changesAuthority = true;
  assert.equal(evaluateLessonPromotion(candidate, SHA).status, 'REJECTED');
});

test('adjudication vocabulary is finite and explicit', () => {
  assert.deepEqual(DECISIONS, ['CONFIRMED', 'REJECTED', 'DISPUTED', 'UNKNOWN']);
});
test('the principal training matrix is exactly ten and excludes the supporting Explorer-2 role', async () => {
  const { AGENTS } = await import('../../../scripts/agent-learning/self-learning-control-plane.mjs');
  assert.equal(AGENTS.length, 10);
  assert.equal(AGENTS.some(a => a.name === 'المستكشف 2'), false);
  assert.deepEqual(AGENTS.slice(0, 7).map(a => a.name), [
    'المستكشف AI',
    'المطور AI',
    'FLIXO i18n Agent',
    'FLIXO Repository Maintainer Agent',
    'FLIXO QA Agent',
    'Red Team 1',
    'Red Team 2',
  ]);
});

test('Scout submissions fail closed outside the canonical report center and on certification escalation', async () => {
  const { validateSubmission } = await import('../../../scripts/agent-learning/self-learning-control-plane.mjs');
  const base = {
    agent: 'FLIXO Technology Scout',
    drill: 'technology-research',
    exactSha: SHA,
    snapshotSha: SHA,
    evidence: ['source'],
    unknowns: [],
    nextActions: ['review'],
    status: 'central-report',
    proposalSchema: 'v4',
    repoRefs: ['package.json'],
    sources: ['source'],
    rollback: 'revert',
    entityKey: 'technology::test',
    lifecycle: 'candidate',
    security: 'reviewed',
    licensing: 'compatible',
    compatibility: 'compatible',
    migrationCost: 'bounded',
    measurableImpact: 'measured',
    executionClaim: true,
  };
  const failures = validateSubmission({ ...base, reportPath: 'الوكلاء/التقارير/AGENT-09 — Technology Scout/proposal.md' }, SHA);
  assert.ok(failures.includes('technology scout status must remain central-report'));
  assert.ok(failures.includes('technology scout cannot claim execution'));
});

test('role submissions reject cross-agent drill identity and unknown agents', async () => {
  const { validateSubmission } = await import('../../../scripts/agent-learning/self-learning-control-plane.mjs');
  const crossAgent = {
    agent: 'Red Team 1',
    drill: 'maintenance',
    exactSha: SHA,
    evidence: ['e'],
    unknowns: [],
    nextActions: ['n'],
    authorityChecks: ['single-registry'],
    driftChecks: ['stale-sha'],
    officialAgentCount: 10,
  };
  const crossFailures = validateSubmission(crossAgent, SHA);
  assert.ok(crossFailures.includes('agent/drill identity binding mismatch'));

  const unknownFailures = validateSubmission({
    ...crossAgent,
    agent: 'not-registered',
  }, SHA);
  assert.ok(unknownFailures.includes('agent is not a registered principal agent'));
});

  
test('learning metrics are bounded and deterministic', async () => {
  const { computeLearningMetrics, validateLearningMetrics } = await import('../../../scripts/agent-learning/learning-metrics.mjs');
  const metrics = computeLearningMetrics({
    retrievals: [
      { sha_freshness: 'CURRENT_SHA', tested_sha: SHA, current_sha: SHA },
      { sha_freshness: 'STALE_EVIDENCE', tested_sha: OTHER_SHA, current_sha: SHA },
    ],
    usage: [
      { outcome: 'HELPFUL', memory_status: 'PROMOTED' },
      { outcome: 'HARMFUL', memory_status: 'PROMOTED' },
      { outcome: 'NEUTRAL', memory_status: 'VALIDATED' },
    ],
    memories: [
      { status: 'PROMOTED', regression_evidence: true, independent_confirmations: 2, contradiction_count: 0 },
      { status: 'DISPUTED', regression_evidence: false, independent_confirmations: 1, contradiction_count: 1 },
    ],
    validationDurationsMs: [100, 300],
    promotionDurationsMs: [500],
  });
  validateLearningMetrics(metrics);
  assert.equal(metrics.retrieval_count, 2);
  assert.equal(metrics.helpful_usage, 1);
  assert.equal(metrics.harmful_usage, 1);
  assert.equal(metrics.reuse_success_rate, 0.5);
  assert.equal(metrics.regression_survival, 1);
  assert.equal(metrics.contradiction_rate, 0.5);
  assert.equal(metrics.staleness_rate, 0.5);
  assert.equal(metrics.time_to_validation, 200);
  assert.equal(metrics.time_to_promotion, 500);
});
