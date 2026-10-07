#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateAgentDrill } from './run-role-drills.mjs';
import { AGENTS as TRAINING_AGENTS, assertSha } from './self-learning-control-plane.mjs';

const ROOT = process.cwd();
const ROLE_RULES = {
  'المستكشف AI': {
    contract:'الوكلاء AI/المستكشف AI/المستكشف.md',
    report:'الوكلاء AI/المستكشف AI/تقارير المستكشف/',
    anchors:['scripts/repository-knowledge-scan.mjs','src/config/registry.ts','src/lib/execution/canonical-executor.ts','src/lib/contracts/tool-output-contracts.ts'],
    required:['Exact-SHA','Semantic analysis','Main branch read scope','Mutation prohibition']
  },
  'المطور AI': {
    contract:'الوكلاء AI/المطور AI/المطور.md',
    report:'الوكلاء AI/المطور AI/تقارير التطوير/',
    anchors:['.github/agents/المطور-ai.md','src/config/registry.ts','package.json'],
    required:['exact SHA','context-equivalent','GAP','licensing']
  },
  'FLIXO i18n Agent': {
    contract:'الوكلاء AI/i18n Agent/العقد.md',
    report:'الوكلاء AI/i18n Agent/التقارير/',
    anchors:['src/lib/i18n/config.ts'],
    required:['RTL/LTR','SEO','exact SHA','missing']
  },
  'FLIXO Repository Maintainer Agent': {
    contract:'الوكلاء AI/Maintainer Agent/العقد.md',
    report:'الوكلاء AI/Maintainer Agent/التقارير/',
    anchors:['src/config/registry.ts','scripts/verify-agent-profiles.mjs','AGENTS.md'],
    required:['duplicate','stale SHA','drift','canonical']
  },
  'FLIXO QA Agent': {
    contract:'الوكلاء AI/QA Agent/العقد.md',
    report:'الوكلاء AI/QA Agent/التقارير/',
    anchors:['package.json','.github/workflows','tests/'],
    required:['cancelled','neutral','missing','stale']
  },
  'Red Team 1': {
    contract:'الوكلاء AI/Red Team 1/العقد.md',
    report:'الوكلاء AI/Red Team 1/التقارير/',
    anchors:['.github/workflows/agent-self-learning.yml','scripts/ci/check-governance.sh'],
    required:['threat model','attack','reproducible','NOT_REPRODUCED']
  },
  'Red Team 2': {
    contract:'الوكلاء AI/Red Team 2/العقد.md',
    report:'الوكلاء AI/Red Team 2/التقارير/',
    anchors:['.github/agents/red-team-1.md','.github/agents/المستكشف-2.md'],
    required:['counterexample','false positives','false negatives','REFUTED']
  },
  'FLIXO Architecture Scout': {
    contract:'الوكلاء AI/المستكشفين/Architecture Scout/المستكشف.md',
    report:'.agent-intelligence/inbox/',
    anchors:['.agent-intelligence/scouts/architecture.yaml','src/config/registry.ts','src/lib/execution/canonical-executor.ts'],
    required:['tools: ["read", "search", "edit"]','inbox','Proposal Schema v4','rollback','provenance']
  },
  'FLIXO Technology Scout': {
    contract:'الوكلاء AI/المستكشفين/Technology Scout/المستكشف.md',
    report:'.agent-intelligence/inbox/',
    anchors:['.agent-intelligence/scouts/technology.yaml','package.json','src/lib/execution/canonical-executor.ts'],
    required:['tools: ["read", "search", "edit"]','inbox','Proposal Schema v4','licensing','compatibility']
  },
  'FLIXO Ecosystem Scout': {
    contract:'الوكلاء AI/المستكشفين/Ecosystem Scout/المستكشف.md',
    report:'.agent-intelligence/inbox/',
    anchors:['.agent-intelligence/scouts/ecosystem.yaml','package.json','src/config/registry.ts'],
    required:['tools: ["read", "search", "edit"]','inbox','Proposal Schema v4','provenance','maturity']
  }
};

function gitHead(){ return execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(); }
function exists(path){ return existsSync(join(ROOT,path)); }
function read(path){ return readFileSync(join(ROOT,path),'utf8'); }
function check(condition, label, remediation){ return {ok:Boolean(condition),label,remediation}; }

export function scoreAgent(agent, sha){
  const rule=ROLE_RULES[agent.name];
  if(!rule) throw new Error('missing role rule: '+agent.name);
  const profile=read(agent.registration);
  const contract=read(rule.contract);
  const checks=[];
  checks.push(check(exists(agent.registration),'official profile exists','restore the official profile'));
  checks.push(check(/100\/100/u.test(profile),'100/100 contract is explicit','complete the role training contract'));
  checks.push(check(/Practical Mastery Loop/u.test(profile),'practical mastery loop is explicit','complete the mastery loop'));
  checks.push(check(sha===gitHead(),'training target equals repository HEAD','re-read the live execution SHA'));
  checks.push(check(exists(rule.contract),'canonical role contract exists','restore the canonical role contract'));
  checks.push(check(profile.includes(rule.report) || contract.includes(rule.report),'bounded report path is declared','declare the isolated report path'));
  for(const anchor of rule.anchors) checks.push(check(exists(anchor),'role anchor exists: '+anchor,'inspect or restore the referenced repository surface'));
  for(const required of rule.required) checks.push(check(profile.toLowerCase().includes(required.toLowerCase()) || contract.toLowerCase().includes(required.toLowerCase()),'training rule present: '+required,'add the missing role-specific training rule'));
  const drill=evaluateAgentDrill(agent.name,sha);
  checks.push(check(drill.validScore===100 && drill.validPassed,'positive role drill passes','repair the role drill or the role contract'));
  checks.push(check(drill.positiveRepeatPasses===5 && drill.deterministic,'positive drill is deterministic across five repetitions','remove nondeterminism from the role drill'));
  checks.push(check(drill.negativeRejected===true && drill.negativeCases>=7,'adversarial negative matrix of seven-plus cases is fully rejected','add a counterexample and fail-closed assertions'));
  const passed=checks.every(item=>item.ok);
  return {name:agent.name,score:passed?100:Math.round((checks.filter(item=>item.ok).length/checks.length)*100),passed,behavioralEvidence:'UNPROVEN',checks,drill};
}

export function evaluateAllAgents(sha){
  assertSha(sha,'executionSha');
  if(TRAINING_AGENTS.length!==14) throw new Error('readiness evaluator requires exactly 14 principal agents');
  const results=TRAINING_AGENTS.map(agent=>scoreAgent(agent,sha));
  return {sha,results,all100:results.every(result=>result.score===100 && result.passed)};
}

export function renderReadinessReport(evaluation){
  const lines=['# FLIXO — Agent 100/100 Readiness Evaluation','','- Exact execution SHA: '+evaluation.sha,'- Principal agents: '+evaluation.results.length+'/10','- All agents 100/100 contract/drill readiness: '+(evaluation.all100?'YES':'NO'),'- Behavioral evidence: UNPROVEN','','| Agent | Score | Drill | Repeats | Deterministic | Negative matrix | Result |','|---|---:|---|---:|---|---:|---|'];
  for(const r of evaluation.results) lines.push('| '+r.name+' | '+r.score+'/100 | '+r.drill.validScore+'/100 | '+r.drill.positiveRepeatPasses+' | '+r.drill.deterministic+' | '+r.drill.negativeRejected+' ('+r.drill.negativeCases+') | '+(r.passed?'PASS':'TRAIN')+' |');
  lines.push('','## Remediation');
  for(const r of evaluation.results.filter(x=>!x.passed)){ lines.push('', '### '+r.name); for(const c of r.checks.filter(x=>!x.ok)) lines.push('- '+c.label+' — '+c.remediation); }
  lines.push('','100/100 here means role-contract and deterministic capability readiness. It does not impersonate a real model run. Behavioral evidence remains UNPROVEN until actual agent executions are independently validated.');
  return lines.join('\n')+'\n';
}

function main(){
  const sha=process.argv[2] ?? process.env.GITHUB_SHA ?? gitHead();
  const evaluation=evaluateAllAgents(sha);
  const output='الوكلاء AI/تدريب الوكلاء AI/تقارير التدريب/'+sha+'-readiness.md';
  mkdirSync(join(ROOT,'الوكلاء AI/تدريب الوكلاء AI/تقارير التدريب'),{recursive:true});
  writeFileSync(join(ROOT,output),renderReadinessReport(evaluation),'utf8');
  console.log(JSON.stringify(evaluation,null,2));
  if(!evaluation.all100) process.exitCode=1;
}

if(process.argv[1]?.endsWith('evaluate-agent-readiness.mjs')) main();
