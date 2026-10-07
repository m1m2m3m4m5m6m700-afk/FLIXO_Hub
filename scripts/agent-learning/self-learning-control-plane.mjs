#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const SHA_RE = /^[0-9a-f]{40}$/i;
export const DECISIONS = ['CONFIRMED', 'REJECTED', 'DISPUTED', 'UNKNOWN'];
export const LESSON_STATUS = ['CANDIDATE', 'PROMOTED', 'STALE_EVIDENCE', 'REVOKED'];

function loadCanonicalPrincipalAgents() {
  const content = readFileSync('الوكلاء.md', 'utf8');
  const start = content.indexOf('<!-- CANONICAL_AGENT_REGISTRY:START -->');
  const end = content.indexOf('<!-- CANONICAL_AGENT_REGISTRY:END -->');
  if (start < 0 || end <= start) throw new Error('canonical agent registry markers missing');
  const block = content.slice(start, end);
  const jsonStart = block.indexOf('```json');
  const jsonEnd = block.indexOf('```', jsonStart + 7);
  if (jsonStart < 0 || jsonEnd <= jsonStart) throw new Error('canonical agent registry JSON missing');
  const registry = JSON.parse(block.slice(jsonStart + 7, jsonEnd).trim());
  if (registry.schema !== 'flixo-canonical-agent-registry-v1') throw new Error('unsupported canonical agent registry schema');
  if (registry.officialAgentCount !== 14 || !Array.isArray(registry.agents) || registry.agents.length !== 14) {
    throw new Error('canonical principal agent count must be exactly 14');
  }
  return registry.agents.map(agent => ({
    id: agent.id,
    name: agent.name,
    registration: agent.profile,
    drill: agent.drill,
    class: agent.class
  }));
}

export const AGENTS = Object.freeze(loadCanonicalPrincipalAgents());



export const ROLE_DRILL_OWNERS = Object.freeze(Object.fromEntries(AGENTS.map(agent => [agent.name, agent.drill])));

export function assertSha(value, field = 'sha') {
  if (!SHA_RE.test(value ?? '')) throw new Error(field + ' must be an exact 40-character git SHA');
  return value.toLowerCase();
}

function isSha(value) { return SHA_RE.test(value ?? ''); }
function nonEmptyArray(value) { return Array.isArray(value) && value.length > 0; }
function nonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }

export function validateSubmission(submission, currentSha) {
  assertSha(currentSha, 'currentSha');
  const failures = [];
  if (!submission || typeof submission !== 'object') return ['submission must be an object'];
  if (!submission.agent) failures.push('agent is required');
  if (submission.agent && !Object.prototype.hasOwnProperty.call(ROLE_DRILL_OWNERS, submission.agent)) failures.push('agent is not a registered principal agent');
  if (submission.agent && submission.drill && ROLE_DRILL_OWNERS[submission.agent] !== submission.drill) failures.push('agent/drill identity binding mismatch');
  if (submission.exactSha !== currentSha) failures.push('exactSha must equal currentSha');
  if (!nonEmptyArray(submission.evidence)) failures.push('at least one evidence item is required');
  if (!Array.isArray(submission.unknowns)) failures.push('unknowns must be an array');
  if (!nonEmptyArray(submission.nextActions)) failures.push('nextActions must be a non-empty array');
  if (submission.forbiddenMutation === true) failures.push('submission crossed its declared mutation boundary');
  if (submission.certificationClaim === true) failures.push('submission claimed certification authority');

  switch (submission.drill) {
    case 'product-experience':
      if (!nonEmptyArray(submission.flows) || !nonEmptyArray(submission.a11yChecks) || !nonEmptyArray(submission.responsiveChecks) || !nonEmptyArray(submission.visualEvidence)) failures.push('product experience evidence is incomplete');
      if (!Array.isArray(submission.rtlLtr) || submission.rtlLtr.length < 2) failures.push('RTL/LTR evidence is required');
      if (!nonEmptyString(submission.privacyBoundary)) failures.push('product experience privacy boundary is required');
      break;
    case 'execution-repair':
      if (!nonEmptyString(submission.implementationPlan) || !nonEmptyArray(submission.changedPaths) || !nonEmptyArray(submission.targetedTests) || !nonEmptyString(submission.regressionTest) || !nonEmptyString(submission.rollback)) failures.push('execution repair evidence is incomplete');
      if (submission.mutationScope !== 'execution-only' || submission.mainMutation === true) failures.push('execution repair must be execution-only');
      if (submission.certificationClaim === true) failures.push('execution repair cannot claim certification');
      break;
    case 'release-assurance':
      if (submission.candidateSha !== currentSha || !nonEmptyArray(submission.requiredChecks) || !nonEmptyArray(submission.lineage) || !nonEmptyArray(submission.artifactDigests) || !nonEmptyString(submission.deploymentIdentity) || !nonEmptyString(submission.rollback) || !nonEmptyString(submission.promotionProof)) failures.push('release assurance evidence is incomplete');
      if (submission.certificationClaim === true) failures.push('release assurance cannot claim certification');
      break;
    case 'reliability-performance':
      if (!nonEmptyArray(submission.metrics) || typeof submission.p50 !== 'number' || typeof submission.p95 !== 'number' || typeof submission.errorRate !== 'number' || !nonEmptyString(submission.memoryBudget) || !nonEmptyString(submission.cpuBudget) || !nonEmptyArray(submission.budgetChecks) || !nonEmptyString(submission.privacyBoundary) || !nonEmptyArray(submission.regressions)) failures.push('reliability performance evidence is incomplete');
      break;
    case 'repository-knowledge':
      if (submission.coveragePercent !== 100) failures.push('explorer coveragePercent must be 100');
      if (!Array.isArray(submission.dependencies)) failures.push('explorer dependencies must be an array');
      if (!Array.isArray(submission.semanticDiff)) failures.push('explorer semanticDiff must be an array');
      if (!Array.isArray(submission.authorityChain) || submission.authorityChain.length < 4) failures.push('explorer authorityChain must include the execution path');
      if (!isSha(submission.mainSha)) failures.push('explorer mainSha must be an exact 40-character SHA');
      break;
    case 'external-comparison':
      if (!isSha(submission.referenceSha)) failures.push('referenceSha must be an exact 40-character SHA');
      if (!nonEmptyArray(submission.comparisons)) failures.push('comparisons are required');
      if (!Array.isArray(submission.priorities)) failures.push('priorities must be an array');
      if (!submission.referenceRevalidated) failures.push('developer reference must be explicitly revalidated');
      break;
    case 'localization':
      if (!nonEmptyArray(submission.localeChecks)) failures.push('localeChecks are required');
      if (submission.rtlChecked !== true || submission.ltrChecked !== true) failures.push('both RTL and LTR must be checked');
      if (submission.seoChecked !== true) failures.push('SEO must be checked');
      if (submission.localeCount !== 20) failures.push('i18n canonical locale count must be 20');
      break;
    case 'maintenance':
      if (!nonEmptyArray(submission.authorityChecks)) failures.push('authorityChecks are required');
      if (!nonEmptyArray(submission.driftChecks)) failures.push('driftChecks are required');
      if (submission.officialAgentCount !== 10) failures.push('maintainer must audit all ten principal agents from canonical registry');
      break;
    case 'verification':
      if (!nonEmptyArray(submission.commands)) failures.push('commands are required');
      if (!nonEmptyArray(submission.statuses)) failures.push('statuses are required');
      if (submission.staleEvidenceRejected !== true) failures.push('stale evidence must be rejected');
      if (!['PASS', 'NOT_PASS'].includes(submission.decision)) failures.push('QA must explicitly classify the evidence');
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
    case 'architecture-research':
      if (submission.status !== 'inbox') failures.push('architecture scout status must remain inbox');
      if (submission.proposalSchema !== 'v4') failures.push('architecture scout must emit Proposal Schema v4');
      if (submission.snapshotSha !== currentSha) failures.push('architecture snapshotSha must equal currentSha');
      if (!nonEmptyArray(submission.repoRefs)) failures.push('architecture repoRefs are required');
      if (!nonEmptyArray(submission.sources)) failures.push('architecture sources are required');
      if (!nonEmptyString(submission.rollback)) failures.push('architecture rollback is required');
      if (!nonEmptyString(submission.entityKey)) failures.push('architecture entityKey is required');
      if (!nonEmptyString(submission.lifecycle)) failures.push('architecture lifecycle is required');
      if (!submission.triage || typeof submission.triage !== 'object') failures.push('architecture triage is required');
      if (!nonEmptyString(submission.fit)) failures.push('architecture repository fit is required');
      if (!nonEmptyString(submission.boundaryRisk)) failures.push('architecture boundary risk is required');
      if (submission.executionClaim === true) failures.push('architecture scout cannot claim execution');
      break;
    case 'technology-research':
      if (submission.status !== 'inbox') failures.push('technology scout status must remain inbox');
      if (submission.proposalSchema !== 'v4') failures.push('technology scout must emit Proposal Schema v4');
      if (submission.snapshotSha !== currentSha) failures.push('technology snapshotSha must equal currentSha');
      if (!nonEmptyArray(submission.repoRefs)) failures.push('technology repoRefs are required');
      if (!nonEmptyArray(submission.sources)) failures.push('technology sources are required');
      if (!nonEmptyString(submission.rollback)) failures.push('technology rollback is required');
      if (!nonEmptyString(submission.entityKey)) failures.push('technology entityKey is required');
      if (!nonEmptyString(submission.lifecycle)) failures.push('technology lifecycle is required');
      if (!nonEmptyString(submission.security)) failures.push('technology security assessment is required');
      if (!nonEmptyString(submission.licensing)) failures.push('technology licensing/provenance is required');
      if (!nonEmptyString(submission.compatibility)) failures.push('technology compatibility is required');
      if (!nonEmptyString(submission.migrationCost)) failures.push('technology migration cost is required');
      if (!submission.measurableImpact) failures.push('technology measurable impact is required');
      if (submission.executionClaim === true) failures.push('technology scout cannot claim execution');
      break;
    case 'ecosystem-research':
      if (submission.status !== 'inbox') failures.push('ecosystem scout status must remain inbox');
      if (submission.proposalSchema !== 'v4') failures.push('ecosystem scout must emit Proposal Schema v4');
      if (submission.snapshotSha !== currentSha) failures.push('ecosystem snapshotSha must equal currentSha');
      if (!nonEmptyArray(submission.repoRefs)) failures.push('ecosystem repoRefs are required');
      if (!nonEmptyArray(submission.sources)) failures.push('ecosystem sources are required');
      if (!nonEmptyArray(submission.sourceDates)) failures.push('ecosystem sourceDates are required');
      if (!nonEmptyArray(submission.independentSignals) || submission.independentSignals.length < 2) failures.push('ecosystem requires at least two independent signals');
      if (!nonEmptyString(submission.maturity)) failures.push('ecosystem maturity classification is required');
      if (!nonEmptyString(submission.provenance)) failures.push('ecosystem provenance is required');
      if (!nonEmptyString(submission.rollback)) failures.push('ecosystem rollback is required');
      if (!nonEmptyString(submission.entityKey)) failures.push('ecosystem entityKey is required');
      if (!nonEmptyString(submission.lifecycle)) failures.push('ecosystem lifecycle is required');
      if (!submission.triage || typeof submission.triage !== 'object') failures.push('ecosystem triage is required');
      if (submission.executionClaim === true) failures.push('ecosystem scout cannot claim execution');
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
    const isScout = ['AGENT-08','AGENT-09','AGENT-10'].includes(agent.id);
    const checks = [
      content.includes('name: ' + agent.name),
      /100\/100/u.test(content),
      /Practical Mastery Loop/u.test(content),
      !/git push origin main|force[- ]push|write directly to main/iu.test(content),
      !/self-certif|declare PASS\/GREEN\/CERTIFIED/iu.test(content),
      isScout
        ? content.includes('tools: ["read", "search", "edit"]') && content.includes('only writable repository path is .agent-intelligence/inbox/')
        : content.includes('tools: read, search, terminal')
    ];
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
  const outputPath = 'الوكلاء AI/تدريب الوكلاء/تقارير التدريب/' + currentSha + '.md';
  console.log(JSON.stringify(generateContractReadinessReport({ currentSha, outputPath }), null, 2));
}

if (process.argv[1]?.endsWith('self-learning-control-plane.mjs')) main();
