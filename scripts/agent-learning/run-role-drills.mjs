#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AGENTS, scoreSubmission, assertSha } from './self-learning-control-plane.mjs';

export const ROLE_DRILLS = {
  'المستكشف AI': {
    drill: 'repository-knowledge',
    valid: sha => ({ agent:'المستكشف AI', drill:'repository-knowledge', exactSha:sha, evidence:['registry:L1','workflow:L1'], unknowns:[], nextActions:['recheck'], coveragePercent:100, dependencies:['route->registry->gate->executor->verifier'], semanticDiff:['added symbol'], authorityChain:['registry','gate','executor','verifier'], mainSha:'dddddddddddddddddddddddddddddddddddddddd' }),
    invalids: [s => ({ agent:'المستكشف AI', drill:'repository-knowledge', exactSha:s, evidence:['e'], unknowns:[], nextActions:['n'], coveragePercent:99, dependencies:[], semanticDiff:[] })],
  },
  'المستكشف 2': {
    drill: 'falsification',
    valid: sha => ({ agent:'المستكشف 2', drill:'falsification', exactSha:sha, evidence:['explorer-report:L1'], unknowns:[], nextActions:['recheck'], targetClaim:'registry is the only authority', alternatives:['generated manifest','legacy executor'], alternativeEvidence:['path search'], conclusion:'CONFIRMED' }),
    invalids: [s => ({ agent:'المستكشف 2', drill:'falsification', exactSha:s, evidence:['e'], unknowns:[], nextActions:['n'], targetClaim:'claim', alternatives:[], conclusion:'UNKNOWN' })],
  },
  'المطور AI': {
    drill: 'external-comparison',
    valid: sha => ({ agent:'المطور AI', drill:'external-comparison', exactSha:sha, evidence:['flixo:arch'], unknowns:[], nextActions:['prioritize'], referenceSha:'cccccccccccccccccccccccccccccccccccccccc', comparisons:['architecture:PARITY','testing:STRONGER_IN_REFERENCE'], priorities:[{gap:'testing',impact:5,effort:3,risk:2,confidence:4}], referenceRevalidated:true }),
    invalids: [s => ({ agent:'المطور AI', drill:'external-comparison', exactSha:s, evidence:['e'], unknowns:[], nextActions:['n'], referenceSha:'not-a-sha', comparisons:[], priorities:[] })],
  },
  'FLIXO i18n Agent': {
    drill: 'localization',
    valid: sha => ({ agent:'FLIXO i18n Agent', drill:'localization', exactSha:sha, evidence:['locale-config'], unknowns:[], nextActions:['verify'], localeChecks:['keys','routes'], rtlChecked:true, ltrChecked:true, seoChecked:true, localeCount:20 }),
    invalids: [s => ({ agent:'FLIXO i18n Agent', drill:'localization', exactSha:s, evidence:['e'], unknowns:[], nextActions:['n'], localeChecks:['keys'], rtlChecked:true, ltrChecked:false, seoChecked:false })],
  },
  'FLIXO Repository Maintainer Agent': {
    drill: 'maintenance',
    valid: sha => ({ agent:'FLIXO Repository Maintainer Agent', drill:'maintenance', exactSha:sha, evidence:['registry','workflow'], unknowns:[], nextActions:['repair'], authorityChecks:['single-registry','single-executor'], driftChecks:['stale-sha','docs-drift'], officialAgentCount:8 }),
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
};

export function evaluateAgentDrill(name, sha) {
  const role=ROLE_DRILLS[name];
  if (!role) throw new Error('No drill for agent: '+name);
  assertSha(sha,'executionSha');
  const valid=scoreSubmission(role.valid(sha),sha);
  const negative=role.invalids.map(make => scoreSubmission(make(sha),sha));
  const negativePassed=negative.every(result => result.passed === false);
  return { name, drill:role.drill, validScore:valid.score, validPassed:valid.passed, negativeCases:negative.length, negativeRejected:negativePassed, passed:valid.passed && negativePassed, behavioralEvidence:'UNPROVEN' };
}

export function evaluateAllAgents(sha) {
  assertSha(sha,'executionSha');
  return AGENTS.map(agent => evaluateAgentDrill(agent.name,sha));
}

export function renderRoleDrillReport(sha, results) {
  const passed=results.filter(r=>r.passed).length;
  const lines=['# FLIXO — Agent Role Drill Evaluation','','- Exact execution SHA: '+sha,'- Role drills: '+results.length,'- Passed: '+passed+'/'+results.length,'- Behavioral evidence: UNPROVEN','','| Agent | Drill | Positive score | Negative cases rejected | Result |','|---|---|---:|---:|---|'];
  for(const r of results) lines.push('| '+r.name+' | '+r.drill+' | '+r.validScore+'/100 | '+r.negativeRejected+'/'+r.negativeCases+' | '+(r.passed?'PASS':'FAIL')+' |');
  lines.push('','> This report evaluates the deterministic role contract fixtures. It does not impersonate a model run or certify production.');
  return lines.join('\n')+'\n';
}

function main(){
  const sha=process.env.GITHUB_SHA ?? process.argv[2];
  assertSha(sha,'executionSha');
  const results=evaluateAllAgents(sha);
  const path='الوكلاء/تدريب الوكلاء/تقارير التدريب/'+sha+'-role-drills.md';
  mkdirSync(join(process.cwd(), 'الوكلاء/تدريب الوكلاء/تقارير التدريب'),{recursive:true});
  writeFileSync(join(process.cwd(),path),renderRoleDrillReport(sha,results),'utf8');
  console.log(JSON.stringify({sha,results},null,2));
  if(results.some(r=>!r.passed)) process.exitCode=1;
}
if(process.argv[1]?.endsWith('run-role-drills.mjs')) main();