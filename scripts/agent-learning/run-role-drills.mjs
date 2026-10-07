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
  const source = readFileSync('الوكلاء AI/المطور AI/مراجع التدريب/README.md', 'utf8');
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
  'المستكشف المعرفي AI': {
    drill: 'repository-knowledge',
    valid: sha => ({ agent:'المستكشف المعرفي AI', drill:'repository-knowledge', exactSha:sha, evidence:['registry:L1','workflow:L1'], unknowns:[], nextActions:['recheck'], coveragePercent:100, dependencies:['route->registry->gate->executor->verifier'], semanticDiff:['added symbol'], authorityChain:['registry','gate','executor','verifier'], mainSha:currentMainSha() }),
    invalids: [s => ({ agent:'المستكشف المعرفي AI', drill:'repository-knowledge', exactSha:s, evidence:['e'], unknowns:[], nextActions:['n'], coveragePercent:99, dependencies:[], semanticDiff:[] })],
  },
  'المطور الهندسي AI': {
    drill: 'external-comparison',
    valid: sha => ({ agent:'المطور الهندسي AI', drill:'external-comparison', exactSha:sha, evidence:['flixo:arch'], unknowns:[], nextActions:['prioritize'], referenceSha:trainingReferenceSha(), comparisons:['architecture:PARITY','testing:STRONGER_IN_REFERENCE'], priorities:[{gap:'testing',impact:5,effort:3,risk:2,confidence:4}], referenceRevalidated:true }),
    invalids: [s => ({ agent:'المطور الهندسي AI', drill:'external-comparison', exactSha:s, evidence:['e'], unknowns:[], nextActions:['n'], referenceSha:'not-a-sha', comparisons:[], priorities:[] })],
  },
  'مُعرّب المنصة AI': {
    drill: 'localization',
    valid: sha => ({ agent:'مُعرّب المنصة AI', drill:'localization', exactSha:sha, evidence:['locale-config'], unknowns:[], nextActions:['verify'], localeChecks:['keys','routes'], rtlChecked:true, ltrChecked:true, seoChecked:true, localeCount:canonicalLocaleCount() }),
    invalids: [s => ({ agent:'مُعرّب المنصة AI', drill:'localization', exactSha:s, evidence:['e'], unknowns:[], nextActions:['n'], localeChecks:['keys'], rtlChecked:true, ltrChecked:false, seoChecked:false })],
  },
  'حارس المستودع AI': {
    drill: 'maintenance',
    valid: sha => ({ agent:'حارس المستودع AI', drill:'maintenance', exactSha:sha, evidence:['registry','workflow'], unknowns:[], nextActions:['repair'], authorityChecks:['single-registry','single-executor'], driftChecks:['stale-sha','docs-drift'], officialAgentCount:10 }),
    invalids: [s => ({ agent:'حارس المستودع AI', drill:'maintenance', exactSha:s, evidence:['e'], unknowns:[], nextActions:['n'], authorityChecks:[], driftChecks:[] })],
  },
  'ضابط الجودة AI': {
    drill: 'verification',
    valid: sha => ({ agent:'ضابط الجودة AI', drill:'verification', exactSha:sha, evidence:['ci-run'], unknowns:[], nextActions:['rerun'], commands:['npm test'], statuses:['queued','pending'], staleEvidenceRejected:true, decision:'NOT_PASS' }),
    invalids: [s => ({ agent:'ضابط الجودة AI', drill:'verification', exactSha:s, evidence:['old-ci'], unknowns:[], nextActions:['n'], commands:[], statuses:['PASS'], staleEvidenceRejected:false })],
  },
  'المهاجم الأمني AI': {
    drill: 'independent-challenge',
    valid: sha => ({ agent:'المهاجم الأمني AI', drill:'independent-challenge', exactSha:sha, evidence:['attack-evidence'], unknowns:[], nextActions:['report'], challenge:'try bypass of exact-SHA gate', reproduction:'safe isolated probe reproduced the boundary', outcome:'BLOCKED', scopeBoundaryTested:true }),
    invalids: [s => ({ agent:'المهاجم الأمني AI', drill:'independent-challenge', exactSha:s, evidence:['e'], unknowns:[], nextActions:['n'], challenge:'attack', reproduction:'', outcome:'UNKNOWN' })],
  },
  'المُفنّد المضاد AI': {
    drill: 'counterexample',
    valid: sha => ({ agent:'المُفنّد المضاد AI', drill:'counterexample', exactSha:sha, evidence:['red-team-1:L1'], unknowns:[], nextActions:['report'], targetFinding:'exact-SHA bypass', counterexample:'counterexample did not bypass the current gate', outcome:'REFUTED', alternativeHypothesis:true }),
    invalids: [s => ({ agent:'المُفنّد المضاد AI', drill:'counterexample', exactSha:s, evidence:['e'], unknowns:[], nextActions:['n'], targetFinding:'finding', counterexample:'', outcome:'UNKNOWN' })],
  },
  'مستكشف العمارة AI': {
    drill: 'architecture-research',
    valid: sha => ({ ...scoutBase('مستكشف العمارة AI','architecture-research',sha), repoRefs:['src/config/registry.ts','src/lib/execution/canonical-executor.ts'], sources:['aws:hexagonal','aws:bounded-contexts'], fit:'candidate ports/adapters seam fits behind canonical executor', boundaryRisk:'avoid second runtime authority' }),
    invalids: [s => ({ ...scoutBase('مستكشف العمارة AI','architecture-research',s), rollback:'', status:'approved', fit:'' })],
  },
  'مستكشف التقنية AI': {
    drill: 'technology-research',
    valid: sha => ({ ...scoutBase('مستكشف التقنية AI','technology-research',sha), repoRefs:['package.json','src/lib/execution/canonical-executor.ts'], sources:['mdn:web-workers','mdn:wasm'], security:'review worker/WASM supply-chain and isolation risks', licensing:'preserve dependency provenance and license compatibility', compatibility:'browser support and existing executor contract remain compatible', migrationCost:'bounded behind an adapter with reversible rollout', measurableImpact:'measure CPU time, memory, bundle size and main-thread blocking before adoption' }),
    invalids: [s => ({ ...scoutBase('مستكشف التقنية AI','technology-research',s), licensing:'', compatibility:'', migrationCost:'', executionClaim:true })],
  },
  'مستكشف النظام البيئي AI': {
    drill: 'ecosystem-research',
    valid: sha => ({ ...scoutBase('مستكشف النظام البيئي AI','ecosystem-research',sha), repoRefs:['package.json','src/config/registry.ts'], sources:['vite:guide','ffmpegwasm:releases','owasp:top10'], sourceDates:['fresh','fresh','stable'], independentSignals:['tooling','media','security'], maturity:'emerging', provenance:'retain official source URLs, source type and exact snapshot references' }),
    invalids: [s => ({ ...scoutBase('مستكشف النظام البيئي AI','ecosystem-research',s), sourceDates:['only-one'], independentSignals:['single-signal'], maturity:'', provenance:'' })],
  },
  'مصمم تجربة المنتج AI': { drill:'product-experience', valid: sha=>({agent:'مصمم تجربة المنتج AI',drill:'product-experience',exactSha:sha,evidence:['journey','a11y'],unknowns:[],nextActions:['verify'],flows:['upload-edit-preview-export'],a11yChecks:['keyboard','focus','labels'],responsiveChecks:['mobile','desktop'],visualEvidence:['baseline'],rtlLtr:['RTL','LTR'],privacyBoundary:'browser-local'}), invalids:[s=>({agent:'مصمم تجربة المنتج AI',drill:'product-experience',exactSha:s,evidence:['e'],unknowns:[],nextActions:['n'],flows:[],a11yChecks:[],responsiveChecks:[],visualEvidence:[],rtlLtr:[],privacyBoundary:''})] },
  'منفذ الإصلاح AI': { drill:'execution-repair', valid: sha=>({agent:'منفذ الإصلاح AI',drill:'execution-repair',exactSha:sha,evidence:['boundary','test'],unknowns:[],nextActions:['regression'],implementationPlan:'smallest repair',changedPaths:['src/example.ts'],targetedTests:['node --test tests/example.test.mjs'],regressionTest:'reproduce then fix',rollback:'revert exact commit',mutationScope:'execution-only',finalSha:sha,mainMutation:false,certificationClaim:false}), invalids:[s=>({agent:'منفذ الإصلاح AI',drill:'execution-repair',exactSha:s,evidence:['e'],unknowns:[],nextActions:['n'],implementationPlan:'',changedPaths:[],targetedTests:[],regressionTest:'',rollback:'',mutationScope:'main',finalSha:s,mainMutation:true})] },
  'ضابط ضمان الإصدار AI': { drill:'release-assurance', valid: sha=>({agent:'ضابط ضمان الإصدار AI',drill:'release-assurance',exactSha:sha,evidence:['rc','checks','artifact'],unknowns:[],nextActions:['recheck'],candidateSha:sha,requiredChecks:['ci','browser','security'],lineage:['execution',sha],artifactDigests:['sha256:training'],deploymentIdentity:'not-deployed-in-training',rollback:'retain known-good SHA',promotionProof:'candidate equals qualified RC',certificationClaim:false}), invalids:[s=>({agent:'ضابط ضمان الإصدار AI',drill:'release-assurance',exactSha:s,evidence:['e'],unknowns:[],nextActions:['n'],candidateSha:'bad',requiredChecks:[],lineage:[],artifactDigests:[],deploymentIdentity:'',rollback:'',promotionProof:'',certificationClaim:true})] },
  'حارس الموثوقية والأداء AI': { drill:'reliability-performance', valid: sha=>({agent:'حارس الموثوقية والأداء AI',drill:'reliability-performance',exactSha:sha,evidence:['p95','error-rate','memory'],unknowns:[],nextActions:['regression'],metrics:['latency','error-rate','memory','cpu'],p50:120,p95:250,errorRate:0.01,memoryBudget:'<=256MiB',cpuBudget:'bounded',budgetChecks:['latency','memory','cpu'],privacyBoundary:'browser-local',regressions:['baseline'] }), invalids:[s=>({agent:'حارس الموثوقية والأداء AI',drill:'reliability-performance',exactSha:s,evidence:['e'],unknowns:[],nextActions:['n'],metrics:[],p50:null,p95:null,errorRate:null,memoryBudget:'',cpuBudget:'',budgetChecks:[],privacyBoundary:'',regressions:[]})] },
};

export function evaluateAgentDrill(name, sha) {
  const role = ROLE_DRILLS[name];
  if (!role) throw new Error('No drill for agent: ' + name);
  assertSha(sha, 'executionSha');

  const validRuns = Array.from({ length: 5 }, () => scoreSubmission(role.valid(sha), sha));
  const validPassed = validRuns.every(result => result.passed && result.score === 100);
  const deterministic = validRuns.every(result => JSON.stringify(result) === JSON.stringify(validRuns[0]));

  const roleNegative = role.invalids.map(make => scoreSubmission(make(sha), sha));
  const wrongSha = scoreSubmission({ ...role.valid(sha), exactSha:'0000000000000000000000000000000000000000' }, sha);
  const forbiddenMutation = scoreSubmission({ ...role.valid(sha), forbiddenMutation:true }, sha);
  const certificationClaim = scoreSubmission({ ...role.valid(sha), certificationClaim:true }, sha);
  const missingEvidence = scoreSubmission({ ...role.valid(sha), evidence:[] }, sha);
  const unknownDrill = scoreSubmission({ ...role.valid(sha), drill:'unknown-drill' }, sha);
  const nullSubmission = scoreSubmission(null, sha);
  const emptyNextActions = scoreSubmission({ ...role.valid(sha), nextActions:[] }, sha);
  const negative = [...roleNegative, wrongSha, forbiddenMutation, certificationClaim, missingEvidence, unknownDrill, nullSubmission, emptyNextActions];
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
  if (AGENTS.length !== 14) throw new Error('principal training matrix must contain exactly 14 agents');
  const results = AGENTS.map(agent => evaluateAgentDrill(agent.name, sha));
  return results;
}

export function renderRoleDrillReport(sha, results) {
  const passed = results.filter(r => r.passed).length;
  const lines = [
    '# FLIXO — Agent Role Drill Evaluation',
    '',
    '- Exact execution SHA: ' + sha,
    '- Principal agents under test: ' + results.length + '/14',
    '- Positive repetitions per agent: 5',
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
  const path = 'الوكلاء AI/تدريب الوكلاء AI/تقارير التدريب/' + sha + '-role-drills.md';
  mkdirSync(join(process.cwd(), 'الوكلاء AI/تدريب الوكلاء AI/تقارير التدريب'), { recursive: true });
  writeFileSync(join(process.cwd(), path), renderRoleDrillReport(sha, results), 'utf8');
  console.log(JSON.stringify({ sha, results }, null, 2));
  if (results.some(r => !r.passed)) process.exitCode = 1;
}
if (process.argv[1]?.endsWith('run-role-drills.mjs')) main();
