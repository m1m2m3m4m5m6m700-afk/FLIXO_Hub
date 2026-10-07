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


test('normalized experience object carries required fields without private reasoning', async () => {
  const { buildExperienceObject, validateExperience, EXPERIENCE_LIFECYCLE } =
    await import('../../../scripts/agent-learning/experience-runtime.mjs');
  const experience = buildExperienceObject({
    experienceId: 'exp-contract-001',
    agentId: 'AGENT-01',
    taskId: 'TASK-001',
    testedSha: SHA,
    objective: 'inspect world model',
    actionSummary: 'compare snapshot layers and verify exact SHA',
    result: 'PASS',
    evidence: ['world-model.json', 'test-evidence'],
    lesson: 'always bind context to current execution SHA',
    nextAction: 'repeat after next mutation',
  });
  assert.equal(validateExperience(experience), true);
  assert.equal(experience.experience_id, 'exp-contract-001');
  assert.equal(experience.agent_id, 'AGENT-01');
  assert.equal(experience.tested_sha, SHA);
  assert.deepEqual(experience.lifecycle, EXPERIENCE_LIFECYCLE);
  assert.throws(
    () => validateExperience({ ...experience, chainOfThought: 'must not persist' }),
    /forbidden private reasoning field/,
  );
});

test('context compiler keeps only current-SHA promoted memory executable', async () => {
  const { compileContext } = await import('../../../scripts/agent-learning/context-compiler.mjs');
  const worldModel = {
    model_version: 'flixo-world-model-v1',
    snapshot_id: 'flixo-world-model-v1:' + SHA,
    exact_sha: SHA,
    generated_at: new Date(0).toISOString(),
    repository_state: { execution_sha: SHA },
    file_index: [
      { path: 'src/feature.ts', category: 'runtime', bytes: 10, sha256: 'a', binary: false, generated: false, language: 'javascript-family', lineCount: 1 },
      { path: 'docs/other.md', category: 'documentation', bytes: 10, sha256: 'b', binary: false, generated: false, language: 'prose', lineCount: 1 },
    ],
    symbol_index: [{ path: 'src/feature.ts', name: 'runFeature', kind: 'function', line: 1, exported: true }],
    dependency_graph: [{ from: 'src/feature.ts', target: 'src/registry.ts' }],
    call_graph: [],
    control_flow_graph: [],
    authority_graph: { nodes: [{ id: 'src/feature.ts', category: 'runtime', authoritySignals: [] }], edges: [], collisions: [] },
    task_graph: { nodes: [], edges: [] },
    semantic_diff: {},
    unknowns: { unresolved_local_imports: 0 },
    evidence_catalog: { static_analysis: { available: true } },
    integrity: {
      immutable_by_identity: true,
      authority_collisions: [],
      required_layers: ['file_index','symbol_index','dependency_graph','call_graph','control_flow_graph','authority_graph','task_graph','semantic_diff'],
    },
    constraints: { mutation_authority: false },
  };
  const context = compileContext({
    task: { task_id: 'TASK-001', title: 'feature run', repo_refs: ['src/feature.ts'] },
    worldModel,
    promotedMemory: [
      { memory_id: 'current', status: 'PROMOTED', tested_sha: SHA },
      { memory_id: 'stale', status: 'PROMOTED', tested_sha: OTHER_SHA },
      { memory_id: 'validated', status: 'VALIDATED', tested_sha: SHA },
    ],
    recentExperiences: [
      { experience_id: 'current-exp', tested_sha: SHA },
      { experience_id: 'stale-exp', tested_sha: OTHER_SHA },
    ],
    knownFailures: [
      { id: 'current-failure', tested_sha: SHA },
      { id: 'stale-failure', tested_sha: OTHER_SHA },
      { id: 'unknown-sha-failure' },
    ],
    currentSha: SHA,
    agentContract: { name: 'AGENT-01', scope: 'read/verify' },
    evidenceRequirements: ['exact SHA'],
  });
  assert.deepEqual(context.executable_memory.map(item => item.memory_id), ['current']);
  assert.equal(context.memory_warnings.length, 2);
  assert.equal(context.experience_warnings.length, 1);
  assert.equal(context.failure_warnings.length, 2);
  assert.equal(context.relevant_files[0].path, 'src/feature.ts');
  assert.equal(context.constraints.mutation_authority, false);
  assert.equal(typeof context.context_hash, 'string');
  assert.equal(context.context_hash.length, 64);
  assert.throws(
    () => compileContext({ task: {}, worldModel: { ...worldModel, exact_sha: OTHER_SHA, snapshot_id: 'flixo-world-model-v1:' + OTHER_SHA }, currentSha: SHA }),
    /WORLD_MODEL_SHA_MISMATCH/,
  );
});


test('context compiler treats SHA-less failures as warnings', async () => {
  const { compileContext } = await import('../../../scripts/agent-learning/context-compiler.mjs');
  const sha = SHA;
  const worldModel = {
    model_version: 'flixo-world-model-v1',
    snapshot_id: 'flixo-world-model-v1:' + sha,
    exact_sha: sha,
    generated_at: new Date(0).toISOString(),
    repository_state: { execution_sha: sha },
    file_index: [],
    symbol_index: [],
    dependency_graph: [],
    call_graph: [],
    control_flow_graph: [],
    authority_graph: { nodes: [], edges: [], collisions: [] },
    task_graph: { nodes: [], edges: [] },
    semantic_diff: {},
    unknowns: {},
    evidence_catalog: { static_analysis: { available: true } },
    integrity: {
      immutable_by_identity: true,
      authority_collisions: [],
      required_layers: ['file_index','symbol_index','dependency_graph','call_graph','control_flow_graph','authority_graph','task_graph','semantic_diff'],
    },
    constraints: { mutation_authority: false },
  };
  const context = compileContext({
    task: {},
    worldModel,
    currentSha: sha,
    knownFailures: [{ id: 'unknown-sha' }],
  });
  assert.equal(context.known_failures.length, 0);
  assert.equal(context.failure_warnings.length, 1);
});


test('external knowledge snapshot suite remains candidate-only and passes its security contract', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync('python3', ['-m', 'unittest', 'tests/agent-intelligence/test_discovery.py'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'pipe',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.doesNotMatch((result.stdout || '') + (result.stderr || ''), /candidate.*PROMOTED|status.*PROMOTED/i);
});


test('shared memory adapter gates executable retrieval by PROMOTED + current SHA and rejects unbounded limits', async () => {
  const { createCognitiveMemoryAdapter, MAX_MEMORY_RESULTS } =
    await import('../../../scripts/agent-learning/shared-memory.mjs');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify([
        { memory_id: 'current', status: 'PROMOTED', tested_sha: SHA },
        { memory_id: 'candidate', status: 'CANDIDATE', tested_sha: SHA },
        { memory_id: 'stale', status: 'PROMOTED', tested_sha: OTHER_SHA },
      ]);
    },
  });
  try {
    const adapter = createCognitiveMemoryAdapter({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'placeholder',
    });
    const result = await adapter.retrieve({ query: 'current lesson', currentSha: SHA, limit: 5 });
    assert.deepEqual(result.executableMemory.map(item => item.memory_id), ['current']);
    assert.equal(result.blockedCount, 2);
    assert.equal(MAX_MEMORY_RESULTS, 50);
    await assert.rejects(
      adapter.retrieve({ query: 'too large', currentSha: SHA, limit: 51 }),
      /MEMORY_RETRIEVAL_LIMIT_INVALID/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
