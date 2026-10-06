#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const SHA_RE = /^[0-9a-f]{40}$/i;
export const DECISIONS = ['CONFIRMED', 'REJECTED', 'DISPUTED', 'UNKNOWN'];
export const LESSON_STATUS = ['CANDIDATE', 'PROMOTED', 'STALE_EVIDENCE', 'REVOKED'];

export const AGENTS = [
  { name: 'المستكشف AI', registration: '.github/agents/المستكشف-ai.md', drill: 'repository-knowledge' },
  { name: 'المستكشف 2', registration: '.github/agents/المستكشف-2.md', drill: 'falsification' },
  { name: 'المطور AI', registration: '.github/agents/المطور-ai.md', drill: 'external-comparison' },
  { name: 'FLIXO i18n Agent', registration: '.github/agents/flixo-i18n-agent.md', drill: 'localization' },
  { name: 'FLIXO Repository Maintainer Agent', registration: '.github/agents/flixo-maintainer-agent.md', drill: 'maintenance' },
  { name: 'FLIXO QA Agent', registration: '.github/agents/flixo-qa-agent.md', drill: 'verification' },
  { name: 'Red Team 1', registration: '.github/agents/red-team-1.md', drill: 'independent-challenge' },
  { name: 'Red Team 2', registration: '.github/agents/red-team-2.md', drill: 'counterexample' },
];

export function assertSha(value, field = 'sha') {
  if (!SHA_RE.test(value ?? '')) throw new Error(field + ' must be an exact 40-character git SHA');
  return value.toLowerCase();
}

function isSha(value) { return SHA_RE.test(value ?? ''); }

export function validateSubmission(submission, currentSha) {
  assertSha(currentSha, 'currentSha');
  const failures = [];
  if (!submission || typeof submission !== 'object') return ['submission must be an object'];
  if (!submission.agent) failures.push('agent is required');
  if (submission.exactSha !== currentSha) failures.push('exactSha must equal currentSha');
  if (!Array.isArray(submission.evidence) || submission.evidence.length === 0) failures.push('at least one evidence item is required');
  if (!Array.isArray(submission.unknowns)) failures.push('unknowns must be an array');
  if (!Array.isArray(submission.nextActions) || submission.nextActions.length === 0) failures.push('nextActions must be a non-empty array');
  if (submission.forbiddenMutation === true) failures.push('submission crossed its declared mutation boundary');
  if (submission.certificationClaim === true) failures.push('submission claimed certification authority');
  switch (submission.drill) {
    case 'repository-knowledge':
      if (submission.coveragePercent !== 100) failures.push('explorer coveragePercent must be 100');
      if (!Array.isArray(submission.dependencies)) failures.push('explorer dependencies must be an array');
      if (!Array.isArray(submission.semanticDiff)) failures.push('explorer semanticDiff must be an array');
      if (!Array.isArray(submission.authorityChain) || submission.authorityChain.length < 4) failures.push('explorer authorityChain must include the execution path');
      if (!isSha(submission.mainSha)) failures.push('explorer mainSha must be an exact 40-character SHA');
      break;
    case 'falsification':
      if (!submission.targetClaim) failures.push('targetClaim is required');
      if (!Array.isArray(submission.alternatives) || submission.alternatives.length < 1) failures.push('at least one alternative explanation is required');
      if (!DECISIONS.includes(submission.conclusion)) failures.push('conclusion must be an adjudication state');
      if (!Array.isArray(submission.alternativeEvidence) || submission.alternativeEvidence.length < 1) failures.push('falsifier must preserve alternative evidence');
      break;
    case 'external-comparison':
      if (!isSha(submission.referenceSha)) failures.push('referenceSha must be an exact 40-character SHA');
      if (!Array.isArray(submission.comparisons) || submission.comparisons.length === 0) failures.push('comparisons are required');
      if (!Array.isArray(submission.priorities)) failures.push('priorities must be an array');
      if (!submission.referenceRevalidated) failures.push('developer reference must be explicitly revalidated');
      break;
    case 'localization':
      if (!Array.isArray(submission.localeChecks) || submission.localeChecks.length === 0) failures.push('localeChecks are required');
      if (submission.rtlChecked !== true || submission.ltrChecked !== true) failures.push('both RTL and LTR must be checked');
      if (submission.seoChecked !== true) failures.push('SEO must be checked');
      if (submission.localeCount !== 20) failures.push('i18n canonical locale count must be 20');
      break;
    case 'maintenance':
      if (!Array.isArray(submission.authorityChecks) || submission.authorityChecks.length === 0) failures.push('authorityChecks are required');
      if (!Array.isArray(submission.driftChecks) || submission.driftChecks.length === 0) failures.push('driftChecks are required');
      if (submission.officialAgentCount !== 8) failures.push('maintainer must audit all eight official agents');
      break;
    case 'verification':
      if (!Array.isArray(submission.commands) || submission.commands.length === 0) failures.push('commands are required');
      if (!Array.isArray(submission.statuses) || submission.statuses.length === 0) failures.push('statuses are required');
      if (submission.staleEvidenceRejected !== true) failures.push('stale evidence must be rejected');
      if (!['PASS','NOT_PASS'].includes(submission.decision)) failures.push('QA must explicitly classify the evidence');
      break;
    case 'independent-challenge':
      if (!submission.challenge) failures.push('challenge is required');
      if (!submission.reproduction) failures.push('reproduction details are required');
      if (!['CONFIRMED', 'BLOCKED', 'NOT_REPRODUCED', 'UNKNOWN'].includes(submission.outcome)) failures.push('challenge outcome is invalid');
      if (submission.scopeBoundaryTested !== true) failures.push('red team must test the authority boundary');
      break;
    case 'counterexample':
      if (!submission.targetFinding) failures.push('targetFinding is required');
      if (!submission.counterexample) failures.push('counterexample is required');
      if (!['CONFIRMED', 'REFUTED', 'DISPUTED', 'NOT_REPRODUCED', 'UNKNOWN'].includes(submission.outcome)) failures.push('counterexample outcome is invalid');
      if (submission.alternativeHypothesis !== true) failures.push('red team 2 must test an alternative hypothesis');
      break;
    default:
      failures.push('unknown training drill');
  }
  return failures;
}

export function scoreSubmission(submission, currentSha) {
  const failures = validateSubmission(submission, currentSha);
  const score = Math.max(0, Math.round(((10 - Math.min(10, failures.length)) / 10) * 100));
  return { score, passed: failures.length === 0, behavioralEvidence: submission?.behavioralEvidence === true ? 'OBSERVED' : 'UNPROVEN', failures };
}

export function buildExperience({ id, agent, exactSha, drill, result, evidence, rootCause = null, lesson = null, review = null, repeatPasses = 0, regressionTest = false, scope = 'repository' }) {
  assertSha(exactSha, 'exactSha');
  if (!id || !agent || !drill) throw new Error('experience requires id, agent, and drill');
  return { id, agent, drill, testedSha: exactSha, result, evidence: Array.isArray(evidence) ? evidence : [], rootCause, lesson, review, repeatPasses, regressionTest, scope, status: 'CANDIDATE' };
}

export function evaluateLessonPromotion(candidate, currentSha) {
  assertSha(currentSha, 'currentSha');
  assertSha(candidate?.testedSha, 'candidate.testedSha');
  if (candidate.testedSha !== currentSha) return { status: 'STALE_EVIDENCE', reason: 'candidate evidence is bound to a different SHA' };
  if (!Array.isArray(candidate.evidence) || candidate.evidence.length === 0) return { status: 'CANDIDATE', reason: 'missing primary evidence' };
  if (candidate.review?.decision !== 'CONFIRMED') return { status: 'CANDIDATE', reason: 'independent review confirmation is required' };
  if (Number(candidate.repeatPasses) < 2) return { status: 'CANDIDATE', reason: 'lesson must survive at least two repeated passes' };
  if (candidate.regressionTest !== true) return { status: 'CANDIDATE', reason: 'lesson must have a regression test' };
  if (candidate.changesAuthority === true) return { status: 'REJECTED', reason: 'lesson cannot create or replace repository authority' };
  return { status: 'PROMOTED', reason: 'current-SHA evidence + independent confirmation + repeat passes + regression test' };
}

export function reconcileLesson(candidate, currentSha) {
  const decision = evaluateLessonPromotion(candidate, currentSha);
  return { ...candidate, status: decision.status, promotionReason: decision.reason };
}

export function renderTrainingReport({ currentSha, results, generatedAt = new Date().toISOString() }) {
  assertSha(currentSha, 'currentSha');
  const lines = ['# FLIXO — Automated Agent Self-Learning Training Report', '', '- Exact execution SHA: ' + currentSha, '- Generated at: ' + generatedAt, '- Contract status: automated', '- Behavioral evidence: ' + (results.some(r => r.behavioralEvidence === 'OBSERVED') ? 'PARTIAL' : 'UNPROVEN'), '', '| Agent | Contract score | Behavioral evidence | Status |', '|---|---:|---|---|'];
  for (const result of results) lines.push('| ' + result.name + ' | ' + result.contractScore + '/100 | ' + result.behavioralEvidence + ' | ' + result.status + ' |');
  lines.push('', '## Promotion rule', '', 'PROMOTED requires current-SHA evidence, independent CONFIRMED review, two repeat passes, and a regression test.', '', 'SHA drift converts evidence to STALE_EVIDENCE.', '', 'Contract score is not a model-intelligence score; behavioral evidence remains UNPROVEN until an actual role-specific run is validated.');
  return lines.join('\n') + '\n';
}

export function loadOfficialAgents(root = process.cwd()) {
  return AGENTS.map(agent => ({ ...agent, content: readFileSync(join(root, agent.registration), 'utf8') }));
}

export function generateContractReadinessReport({ root = process.cwd(), currentSha, outputPath }) {
  const results = loadOfficialAgents(root).map(agent => {
    const content = agent.content;
    const checks = [content.includes('name: ' + agent.name), content.includes('tools: read, search, terminal'), /100\/100/u.test(content), !/git push origin main|force[- ]push|write directly to main/iu.test(content), !/self-certif|declare PASS\/GREEN\/CERTIFIED/iu.test(content)];
    const contractScore = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    return { name: agent.name, contractScore, behavioralEvidence: 'UNPROVEN', status: contractScore === 100 ? 'CONTRACT_READY' : 'CONTRACT_GAP' };
  });
  const report = renderTrainingReport({ currentSha, results });
  mkdirSync(join(root, outputPath, '..'), { recursive: true });
  writeFileSync(join(root, outputPath), report, 'utf8');
  return { currentSha, results, outputPath };
}

function main() {
  const currentSha = process.argv.find(arg => SHA_RE.test(arg)) ?? process.env.GITHUB_SHA;
  if (!SHA_RE.test(currentSha ?? '')) { process.exitCode = 2; return; }
  const outputPath = 'الوكلاء/تدريب الوكلاء/تقارير التدريب/' + currentSha + '.md';
  console.log(JSON.stringify(generateContractReadinessReport({ currentSha, outputPath }), null, 2));
}

if (process.argv[1]?.endsWith('self-learning-control-plane.mjs')) main();