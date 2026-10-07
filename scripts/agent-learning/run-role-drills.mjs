#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENTS, scoreSubmission, assertSha } from './self-learning-control-plane.mjs';

function gitRef(ref) { return execFileSync('git', ['rev-parse', ref], { encoding: 'utf8' }).trim(); }
function currentMainSha() { try { return gitRef('refs/remotes/origin/main'); } catch { return gitRef('main'); } }
function canonicalLocaleCount() {
  const source = readFileSync('src/lib/i18n/config.ts', 'utf8');
  const block = source.split('CANONICAL_LOCALES = [')[1]?.split('] as const')[0] ?? '';
  return (block.match(/'[a-z]{2}'/g) ?? []).length;
}
function trainingReferenceSha() {
  const source = readFileSync('الوكلاء/المطور AI/مراجع التدريب/README.md', 'utf8');
  return source.match(/[0-9a-f]{40}/i)?.[0] ?? '';
}

const scoutBase = (agent, drill, sha) => ({
  agent,
  drill,
  exactSha: sha,
  snapshotSha: sha,
  evidence: ['manifest:role-signal', 'registry:repo-ref'],
  unknowns: ['runtime behavior still requires a real agent run'],
  nextActions: ['recheck', 'independent-review'],
  status: 'inbox',
  proposalSchema: 'v4',
  repoRefs: ['src/config/registry.ts'],
  sources: ['official:manifest'],
  rollback: 'Revert the candidate proposal and preserve the proven canonical path.',
  entityKey: agent + '::training',
  lifecycle: 'candidate',
  triage: { priority: 'medium', decision: 'research-only' },
  executionClaim: false
});

export const ROLE_DRILLS = {
  'المستكشف AI': {
    drill: 'repository-knowledge',
    valid: sha => ({ agent:'المستكشف AI', drill:'repository-knowledge', exactSha:sha, evidence:['registry:L1','workflow:L1'], unknowns:[], nextActions:['recheck'], coveragePercent:100, dependencies:['route->registry->gate->executor->verifier'], semanticDiff:['added symbol'], authorityChain:['registry','gate','executor','verifier'], mainSha:currentMainSha() }),
    invalids: [s => ({ agent:'المستكشف AI', drill:'repository-knowledge', exactSha:s, evidence:['e'], unknowns:[], nextActions:['n'], coveragePercent:99, dependencies:[], semanticDiff:[] })],
  },
  'المطور AI': {
    drill: 'external-comparison',
    valid: sha => ({ agent:'المطور AI', drill:'external-comparison', exactSha:sha, evidence:['flixo:arch'], unknowns:[], nextActions:['prioritize'], referenceSha:trainingReferenceSha(), comparisons:['architecture:PARITY','testing:STRONGER_IN_REFERENCE'], priorities:[{gap:'testing',impact:5,effort:3,risk:2,confidence:4}], referenceRevalidated:true }),
    invalids: [s => ({ agent:'المطور AI', drill:'external-comparison', exactSha:s, evidence:['e'], unknowns:[], nextActions:['n'], referenceSha:'not-a-sha', comparisons:[], priorities:[] })],
  },
  'FLIXO i18n Agent': {
    drill: 'localization',
    valid: sha => ({ agent:'FLIXO i18n Agent', drill:'localization', exactSha:sha, evidence:['locale-config'], unknowns:[], nextActions:['verify'], localeChecks:['keys','routes'], rtlChecked:true, ltrChecked:true, seoChecked:true, localeCount:canonicalLocaleCount() }),
    invalids: [s => ({ agent:'FLIXO i18n Agent', drill:'localization', exactSha:s, evidence:['e'], unknowns:[], nextActions:['n'], localeChecks:['keys'], rtlChecked:true, ltrChecked:false, seoChecked:false })],
  },
  'FLIXO Repository Maintainer Agent': {
    drill: 'maintenance',
    valid: sha => ({ agent:'FLIXO Repository Maintainer Agent', drill:'maintenance', exactSha:sha, evidence:['registry','workflow'], unknowns:[], nextActions:['repair'], authorityChecks:['single-registry','single-executor'], driftChecks:['stale-sha','docs-drift'], officialAgentCount:10 }),
    invalids: [s => ({ agent:'FLIXO Repository Maintainer Agent', drill:'maintenance', exactSha:s, evidence:['e'], unknowns:[], nextActions:['n'], authorityChecks:[], driftChecks:[] })],
  },
  'FLIXO QA Agent': {
    drill: 'verification',
    valid: sha => ({ agent:'FLIXO QA Agent', drill:'verification', exactSha:sha, evidence:['ci-run'], unknowns:[], nextActions:['rerun'], commands:['npm test'], statuses:['queued','pending'], staleEvidenceRejected:true, decision:'NOT_PASS' }),
    invalids: [s => ({ agent:'FLIXO QA Agent', drill:'verification', exactSha:s, evidence:['old-ci'], unknowns:[], nextActions:['n'], commands:[], statuses:['PASS'], staleEvidenceRejected:false })],
  },
  'Red Team 1': {
    drill: 'independent-challenge',
    valid: sha => ({ agent:'Red Team 1', drill:'independent-challenge', exactSha:sha, evidence:['attack-evidence'], unknowns:[], nextActions:['report'], challenge:'try bypass of exact-SHA gate', reproduction:'safe isolated probe reproduced the boundary', outcome:'BLOCKED', scopeBoundaryTested:true }),
    invalids: [s => ({ agent:'Red Team 1', drill:'independent-challenge', exactSha:s, evidence:['e'], unknowns:[], nextActions:['n'], challenge:'attack', reproduction:'', outcome:'UNKNOWN' })],
  },
  'Red Team 2': {
    drill: 'counterexample',
    valid: sha => ({ agent:'Red Team 2', drill:'counterexample', exactSha:sha, evidence:['red-team-1:L1'], unknowns:[], nextActions:['report'], targetFinding:'exact-SHA bypass', counterexample:'counterexample did not bypass the current gate', outcome:'REFUTED', alternativeHypothesis:true }),
    invalids: [s => ({ agent:'Red Team 2', drill:'counterexample', exactSha:s, evidence:['e'], unknowns:[], nextActions:['n'], targetFinding:'finding', counterexample:'', outcome:'UNKNOWN' })],
  },
  'FLIXO Architecture Scout': {
    drill: 'architecture-research',
    valid: sha => ({ ...scoutBase('FLIXO Architecture Scout','architecture-research',sha), repoRefs:['src/config/registry.ts','src/lib/execution/canonical-executor.ts'], sources:['aws:hexagonal','aws:bounded-contexts'], fit:'candidate ports/adapters seam fits behind canonical executor', boundaryRisk:'avoid second runtime authority' }),
    invalids: [s => ({ ...scoutBase('FLIXO Architecture Scout','architecture-research',s), rollback:'', status:'approved', fit:'' })],
  },
  'FLIXO Technology Scout': {
    drill: 'technology-research',
    valid: sha => ({ ...scoutBase('FLIXO Technology Scout','technology-research',sha), repoRefs:['package.json','src/lib/execution/canonical-executor.ts'], sources:['mdn:web-workers','mdn:wasm'], security:'review worker/WASM supply-chain and isolation risks', licensing:'preserve dependency provenance and license compatibility', compatibility:'browser support and existing executor contract remain compatible', migrationCost:'bounded behind an adapter with reversible rollout', measurableImpact:'measure CPU time, memory, bundle size and main-thread blocking before adoption' }),
    invalids: [s => ({ ...scoutBase('FLIXO Technology Scout','technology-research',s), licensing:'', compatibility:'', migrationCost:'', executionClaim:true })],
  },
  'FLIXO Ecosystem Scout': {
    drill: 'ecosystem-research',
    valid: sha => ({ ...scoutBase('FLIXO Ecosystem Scout','ecosystem-research',sha), repoRefs:['package.json','src/config/registry.ts'], sources:['vite:guide','ffmpegwasm:releases','owasp:top10'], sourceDates:['fresh','fresh','stable'], independentSignals:['tooling','media','security'], maturity:'emerging', provenance:'retain official source URLs, source type and exact snapshot references' }),
    invalids: [s => ({ ...scoutBase('FLIXO Ecosystem Scout','ecosystem-research',s), sourceDates:['only-one'], independentSignals:['single-signal'], maturity:'', provenance:'' })],
  },
};

export function evaluateAgentDrill(name, sha) {
  const role = ROLE_DRILLS[name];
  if (!role) throw new Error('No drill for agent: ' + name);
  assertSha(sha, 'executionSha');

  const validRuns = Array.from({ length: 3 }, () => scoreSubmission(role.valid(sha), sha));
  const validPassed = validRuns.every(result => result.passed && result.score === 100);
  const deterministic = validRuns.every(result => JSON.stringify(result) === JSON.stringify(validRuns[0]));

  const roleNegative = role.invalids.map(make => scoreSubmission(make(sha), sha));
  const wrongSha = scoreSubmission({ ...role.valid(sha), exactSha:'0000000000000000000000000000000000000000' }, sha);
  const forbiddenMutation = scoreSubmission({ ...role.valid(sha), forbiddenMutation:true }, sha);
  const certificationClaim = scoreSubmission({ ...role.valid(sha), certificationClaim:true }, sha);
  const negative = [...roleNegative, wrongSha, forbiddenMutation, certificationClaim];
  const negativeRejected = negative.every(result => result.passed === false);

  return {
    name,
    drill: role.drill,
    validScore: validRuns[0].score,
    validPassed,
    positiveRepeatPasses: validRuns.length,
    deterministic,
    negativeCases: negative.length,
    negativeRejected,
    passed: validPassed && deterministic && negativeRejected,
    behavioralEvidence: 'UNPROVEN',
  };
}

export function evaluateAllAgents(sha) {
  assertSha(sha, 'executionSha');
  if (AGENTS.length !== 10) throw new Error('principal training matrix must contain exactly 10 agents');
  const results = AGENTS.map(agent => evaluateAgentDrill(agent.name, sha));
  return results;
}

export function renderRoleDrillReport(sha, results) {
  const passed = results.filter(r => r.passed).length;
  const lines = [
    '# FLIXO — Agent Role Drill Evaluation',
    '',
    '- Exact execution SHA: ' + sha,
    '- Principal agents under test: ' + results.length + '/10',
    '- Positive repetitions per agent: 3',
    '- Passed: ' + passed + '/' + results.length,
    '- Behavioral evidence: UNPROVEN',
    '',
    '| Agent | Drill | Positive score | Repeats | Deterministic | Negative cases rejected | Result |',
    '|---|---|---:|---:|---|---:|---|'
  ];
  for (const r of results) lines.push('| ' + r.name + ' | ' + r.drill + ' | ' + r.validScore + '/100 | ' + r.positiveRepeatPasses + ' | ' + r.deterministic + ' | ' + r.negativeRejected + '/' + r.negativeCases + ' | ' + (r.passed ? 'PASS' : 'FAIL') + ' |');
  lines.push('', '> This report evaluates the deterministic role contract matrix. It does not impersonate a model run or certify production behavior.');
  return lines.join('\n') + '\n';
}

function main() {
  const sha = process.env.GITHUB_SHA ?? process.argv[2];
  assertSha(sha, 'executionSha');
  const results = evaluateAllAgents(sha);
  const path = 'الوكلاء/تدريب الوكلاء/تقارير التدريب/' + sha + '-role-drills.md';
  mkdirSync(join(process.cwd(), 'الوكلاء/تدريب الوكلاء/تقارير التدريب'), { recursive: true });
  writeFileSync(join(process.cwd(), path), renderRoleDrillReport(sha, results), 'utf8');
  console.log(JSON.stringify({ sha, results }, null, 2));
  if (results.some(r => !r.passed)) process.exitCode = 1;
}
if (process.argv[1]?.endsWith('run-role-drills.mjs')) main();
