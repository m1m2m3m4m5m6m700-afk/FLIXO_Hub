#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { appendActivityEvent } from '../agent-activity-ledger.mjs';
import { compileContext } from './context-compiler.mjs';
import { createCognitiveMemoryAdapter, preflightMemoryRetrieval, assertExactSha } from './shared-memory.mjs';
import { buildExperienceObject, validateExperience, EXPERIENCE_LIFECYCLE } from './experience-runtime.mjs';
import { computeLearningMetrics, validateLearningMetrics } from './learning-metrics.mjs';
import { validateKnowledgeSnapshot } from './world-model-contract.mjs';

export const MEMORY_LIFECYCLE = Object.freeze([
  'CANDIDATE',
  'VALIDATED',
  'PROMOTED',
  'DISPUTED',
  'STALE_EVIDENCE',
  'REVOKED',
  'SUPERSEDED',
]);

export const LEARNING_KINDS = Object.freeze([
  'LESSON',
  'ANTI_LESSON',
  'HEURISTIC',
  'PATTERN',
  'WARNING',
  'FACT',
]);

export function normalizeSha(value, field = 'sha') {
  return assertExactSha(value, field);
}

function nonEmpty(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(field + ' is required');
  return value.trim();
}

function countIndependentReviewers(review, candidate = {}) {
  if (Number.isInteger(candidate.independentConfirmations)) return candidate.independentConfirmations;
  if (Number.isInteger(review?.independentConfirmations)) return review.independentConfirmations;
  if (Array.isArray(review?.reviewers)) {
    return new Set(review.reviewers.map(String).filter(Boolean)).size;
  }
  return review?.decision === 'CONFIRMED' ? 1 : 0;
}

function countIndependentUsage(candidate) {
  if (Number.isInteger(candidate.independentUsageCount)) return candidate.independentUsageCount;
  if (Array.isArray(candidate.independentUsages)) {
    return new Set(candidate.independentUsages.map(String).filter(Boolean)).size;
  }
  return 0;
}

function scanPrivateReasoning(value, path = 'value', seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  const forbidden = /^(?:chain[-_ ]?of[-_ ]?thought|scratchpad|private[-_ ]?reasoning|reasoning[-_ ]?trace|hidden[-_ ]?thoughts?)$/iu;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.test(key)) throw new Error('PRIVATE_REASONING_FIELD_FORBIDDEN:' + path + '.' + key);
    scanPrivateReasoning(child, path + '.' + key, seen);
  }
}

export function buildExperience(input = {}) {
  const experience = buildExperienceObject(input);
  validateExperience(experience);
  return Object.freeze(experience);
}

export function deriveCandidateLesson(experience, currentSha) {
  const current = normalizeSha(currentSha, 'currentSha');
  validateExperience(experience);
  if (experience.tested_sha !== current) {
    return {
      status: 'STALE_EVIDENCE',
      kind: null,
      experience_id: experience.experience_id,
      tested_sha: experience.tested_sha,
      current_sha: current,
      promotable: false,
      reason: 'experience evidence is stale for the current execution SHA',
    };
  }

  const kind = experience.counterexample ? 'ANTI_LESSON'
    : experience.lesson ? 'LESSON'
      : 'HEURISTIC';

  return {
    status: 'CANDIDATE',
    kind,
    experience_id: experience.experience_id,
    tested_sha: current,
    claim: String(experience.lesson ?? experience.counterexample ?? experience.next_action ?? experience.result).trim(),
    evidence: [...experience.evidence],
    source: 'experience',
    promotable: false,
    reason: 'candidate requires independent review, independent usage, regression survival, and promotion gate',
  };
}

export function reconcileCandidateLesson(candidate, currentSha) {
  const current = normalizeSha(currentSha, 'currentSha');
  if (!candidate || typeof candidate !== 'object') throw new Error('candidate lesson is required');
  if (candidate.tested_sha !== current) {
    return { ...candidate, status: 'STALE_EVIDENCE', promotable: false, reason: 'candidate evidence is stale' };
  }
  if (!LEARNING_KINDS.includes(String(candidate.kind ?? '').toUpperCase())) {
    throw new Error('candidate lesson kind is invalid');
  }

  const reviewDecision = String(candidate.review?.decision ?? '').toUpperCase();
  const harmfulUsage = Number(candidate.harmfulUsageCount ?? candidate.harmful_count ?? 0);
  const independentConfirmations = countIndependentReviewers(candidate.review, candidate);
  const independentUsageCount = countIndependentUsage(candidate);
  const repeatPasses = Number(candidate.repeatPasses ?? 0);
  const regressionTest = candidate.regressionTest === true;

  if (candidate.changesAuthority === true) {
    return { ...candidate, status: 'DISPUTED', promotable: false, reason: 'learning cannot create or replace repository authority' };
  }
  if (harmfulUsage > 0 || reviewDecision === 'REJECTED' || reviewDecision === 'DISPUTED') {
    return { ...candidate, status: 'DISPUTED', promotable: false, reason: 'contradictory or harmful evidence blocks retrieval and promotion' };
  }
  if (reviewDecision !== 'CONFIRMED' || independentConfirmations < 2) {
    return { ...candidate, status: 'CANDIDATE', promotable: false, reason: 'at least two independent confirmations are required' };
  }
  if (independentUsageCount < 2 || repeatPasses < 2 || !regressionTest) {
    return {
      ...candidate,
      status: 'VALIDATED',
      promotable: false,
      independent_confirmations: independentConfirmations,
      independent_usage_count: independentUsageCount,
      reason: 'validated but not yet promotion-eligible',
    };
  }

  return {
    ...candidate,
    status: 'VALIDATED',
    promotable: false,
    ready_for_canonical_reconcile: true,
    independent_confirmations: independentConfirmations,
    independent_usage_count: independentUsageCount,
    reason: 'eligible for canonical shared-memory reconciliation; this adapter cannot promote memory',
  };
}

export function classifyMemoryForExecution(memory, currentSha) {
  const current = normalizeSha(currentSha, 'currentSha');
  const classified = preflightMemoryRetrieval({
    currentSha: current,
    memories: [memory],
  });
  return classified.executableMemory[0] ?? classified.warnings[0];
}

export async function recordPromotedMemoryUsage({
  adapter,
  memory,
  currentSha,
  agentId,
  taskId,
  outcome,
  evidenceRefs,
  notes = '',
} = {}) {
  const current = normalizeSha(currentSha, 'currentSha');
  if (!memory || typeof memory !== 'object') throw new Error('memory is required');
  if (memory.status !== 'PROMOTED' || String(memory.tested_sha ?? '').toLowerCase() !== current) {
    throw new Error('MEMORY_USAGE_NOT_EXECUTABLE');
  }
  nonEmpty(agentId, 'agentId');
  nonEmpty(taskId, 'taskId');
  const refs = Array.isArray(evidenceRefs) ? evidenceRefs : [];
  if (refs.length === 0) throw new Error('evidenceRefs are required');
  const usage = await (adapter ?? createCognitiveMemoryAdapter()).usage({
    memoryId: memory.memory_id,
    agentId,
    taskId,
    exactSha: current,
    outcome,
    evidenceRefs: refs,
    notes,
  });
  if (outcome === 'HARMFUL' && usage?.status !== 'DISPUTED') {
    throw new Error('MEMORY_HARM_NOT_BLOCKED');
  }
  return usage;
}

export async function assembleCognitiveContext({
  task = {},
  worldModel,
  currentSha,
  agentContract = {},
  evidenceRequirements = [],
  recentExperiences = [],
  knownFailures = [],
  limits = {},
  memoryAdapter,
  query = '',
} = {}) {
  const current = normalizeSha(currentSha, 'currentSha');
  validateKnowledgeSnapshot(worldModel, { currentSha: current, now: Date.now() });
  scanPrivateReasoning(task);
  scanPrivateReasoning(recentExperiences);
  scanPrivateReasoning(knownFailures);

  const adapter = memoryAdapter ?? createCognitiveMemoryAdapter();
  const memoryResult = await adapter.retrieve({
    query: String(query ?? ''),
    currentSha: current,
    limit: Math.min(50, Math.max(1, Number(limits.maxMemoryResults ?? 8))),
  });

  const context = compileContext({
    task,
    worldModel,
    promotedMemory: memoryResult.executableMemory,
    recentExperiences,
    knownFailures,
    currentSha: current,
    agentContract,
    evidenceRequirements,
    limits,
  });

  if (context.constraints?.mutation_authority !== false ||
      context.constraints?.planner_authority !== false ||
      context.constraints?.certification_authority !== false) {
    throw new Error('COGNITIVE_CONTEXT_AUTHORITY_ESCALATION');
  }
  if (context.current_sha !== current) throw new Error('COGNITIVE_CONTEXT_SHA_MISMATCH');
  return Object.freeze({
    context,
    retrieval: memoryResult,
  });
}

export function buildLearningMetrics(input) {
  const metrics = computeLearningMetrics(input);
  validateLearningMetrics(metrics);
  return Object.freeze(metrics);
}

export function classifyExternalSnapshot(snapshotPath) {
  const text = readFileSync(snapshotPath, 'utf8');
  let snapshot;
  try {
    snapshot = JSON.parse(text);
  } catch (error) {
    throw new Error('EXTERNAL_SNAPSHOT_INVALID_JSON:' + (error instanceof Error ? error.message : String(error)));
  }

  const snapshotId = nonEmpty(snapshot?.snapshot_id, 'snapshot_id');
  if (!/^snap-[0-9]{8}T[0-9]{6}[0-9]{6}Z-[0-9a-f]{16}$/u.test(snapshotId)) {
    throw new Error('EXTERNAL_SNAPSHOT_ID_INVALID');
  }
  const url = nonEmpty(snapshot?.url, 'url');
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('EXTERNAL_SNAPSHOT_URL_INVALID');
  }
  if (parsed.protocol !== 'https:') throw new Error('EXTERNAL_SNAPSHOT_URL_NOT_HTTPS');
  const content = nonEmpty(snapshot?.content, 'content');
  if (content.length > 12000) throw new Error('EXTERNAL_SNAPSHOT_CONTENT_TOO_LARGE');

  return Object.freeze({
    snapshot_id: snapshotId,
    captured_at: snapshot.captured_at ?? null,
    source_url: url,
    source_type: snapshot.source_type ?? 'unknown',
    stability: snapshot.stability ?? 'unknown',
    evidence_kind: snapshot.evidence_kind ?? 'documentation',
    content,
    status: 'CANDIDATE',
    executable: false,
    fact_authority: false,
    promotion: 'REQUIRED_INDEPENDENT_VALIDATION',
  });
}

export function assertExperienceEventType(eventType) {
  if (!EXPERIENCE_LIFECYCLE.includes(eventType)) {
    throw new Error('EXPERIENCE_EVENT_TYPE_INVALID:' + eventType);
  }
  return eventType;
}

export function recordExperienceEvent(input = {}) {
  const eventType = assertExperienceEventType(input.eventType);
  const shaBefore = normalizeSha(input.shaBefore, 'shaBefore');
  const shaAfter = input.shaAfter === undefined || input.shaAfter === 'UNCHANGED'
    ? 'UNCHANGED'
    : normalizeSha(input.shaAfter, 'shaAfter');

  return appendActivityEvent({
    ...input,
    eventType,
    shaBefore,
    shaAfter,
  });
}
