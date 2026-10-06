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