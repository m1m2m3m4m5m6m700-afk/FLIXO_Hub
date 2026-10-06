#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateAgentDrill } from './run-role-drills.mjs';

const ROOT = process.cwd();
const SHA_RE = /^[0-9a-f]{40}$/i;

const AGENTS = [
  { name:'المستكشف AI', profile:'.github/agents/المستكشف-ai.md', contract:'الوكلاء/المستكشف AI/المستكشف.md', report:'الوكلاء/المستكشف AI/تقارير المستكشف/', anchors:['scripts/repository-knowledge-scan.mjs','src/config/registry.ts','src/lib/execution/canonical-executor.ts','src/lib/contracts/tool-output-contracts.ts'], required:['Exact-SHA','Semantic analysis','Main branch read scope','Mutation prohibition'] },
  { name:'المستكشف 2', profile:'.github/agents/المستكشف-2.md', contract:'الوكلاء/المستكشف 2/المستكشف-2.md', report:'الوكلاء/المستكشف 2/تقارير الاعتراضات/', anchors:['.github/agents/المستكشف-ai.md','scripts/repository-knowledge-scan.mjs','src/config/registry.ts'], required:['بديل','نفس SHA','DISPUTED','UNKNOWN'] },
  { name:'المطور AI', profile:'.github/agents/المطور-ai.md', contract:'الوكلاء/المطور AI/المطور.md', report:'الوكلاء/المطور AI/تقارير التطوير/', anchors:['.github/agents/المطور-ai.md','src/config/registry.ts','package.json'], required:['exact SHA','context-equivalent','GAP','licensing'] },
  { name:'FLIXO i18n Agent', profile:'.github/agents/flixo-i18n-agent.md', contract:'الوكلاء/i18n Agent/العقد.md', report:'الوكلاء/i18n Agent/التقارير/', anchors:['src/lib/i18n/config.ts'], required:['RTL/LTR','SEO','exact SHA','missing'] },
  { name:'FLIXO Repository Maintainer Agent', profile:'.github/agents/flixo-maintainer-agent.md', contract:'الوكلاء/Maintainer Agent/العقد.md', report:'الوكلاء/Maintainer Agent/التقارير/', anchors:['src/config/registry.ts','scripts/verify-agent-profiles.mjs','AGENTS.md'], required:['duplicate','stale SHA','drift','canonical'] },
  { name:'FLIXO QA Agent', profile:'.github/agents/flixo-qa-agent.md', contract:'الوكلاء/QA Agent/العقد.md', report:'الوكلاء/QA Agent/التقارير/', anchors:['package.json','.github/workflows','tests/'], required:['cancelled','neutral','missing','stale'] },
  { name:'Red Team 1', profile:'.github/agents/red-team-1.md', contract:'الوكلاء/Red Team 1/العقد.md', report:'الوكلاء/Red Team 1/التقارير/', anchors:['.github/workflows/agent-self-learning.yml','scripts/ci/check-governance.sh'], required:['threat model','attack','reproducible','NOT_REPRODUCED'] },
  { name:'Red Team 2', profile:'.github/agents/red-team-2.md', contract:'الوكلاء/Red Team 2/العقد.md', report:'الوكلاء/Red Team 2/التقارير/', anchors:['.github/agents/red-team-1.md','.github/agents/المستكشف-2.md'], required:['counterexample','false positives','false negatives','REFUTED'] },
];

function gitHead(){ return execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(); }
function exists(path){ return existsSync(join(ROOT,path)); }
function read(path){ return readFileSync(join(ROOT,path),'utf8'); }
function check(condition, label, remediation){ return {ok:Boolean(condition),label,remediation}; }

export function scoreAgent(agent, sha){
  const checks=[];
  checks.push(check(exists(agent.profile),'official profile exists','restore the official profile'));
  checks.push(check(/100\/100/u.test(read(agent.profile)),'100/100 contract is explicit','complete the role training contract'));
  if(agent.contract){ checks.push(check(exists(agent.contract),'canonical role contract exists','restore the canonical role contract')); }
  if(agent.report){ checks.push(check(read(agent.profile).includes(agent.report) || read(agent.contract).includes(agent.report),'bounded report path is declared','declare the isolated report path')); }
  checks.push(check(sha===gitHead(),'training target equals repository HEAD','re-read the live execution SHA'));
  for(const anchor of agent.anchors) checks.push(check(exists(anchor),'role anchor exists: '+anchor,'inspect or restore the referenced repository surface'));
  for(const required of agent.required) checks.push(check(read(agent.profile).toLowerCase().includes(required.toLowerCase()) || (agent.contract && read(agent.contract).toLowerCase().includes(required.toLowerCase())),'training rule present: '+required,'add the missing role-specific training rule'));
  const drill=evaluateAgentDrill(agent.name,sha);
  checks.push(check(drill.validScore===100 && drill.validPassed,'positive role drill passes','repair the role drill or the role contract'));
  checks.push(check(drill.negativeRejected===true,'negative role drill is rejected','add a counterexample and fail-closed assertion'));
  const passed=checks.every(item=>item.ok);
  return {name:agent.name,score:passed?100:Math.round((checks.filter(item=>item.ok).length/checks.length)*100),passed,behavioralEvidence:'UNPROVEN',checks,drill};
}

export function evaluateAllAgents(sha){
  if(!SHA_RE.test(sha??'')) throw new Error('execution SHA must be exact');
  const results=AGENTS.map(agent=>scoreAgent(agent,sha));
  return {sha,results,all100:results.every(result=>result.score===100 && result.passed)};
}

export function renderReadinessReport(evaluation){
  const lines=['# FLIXO — Agent 100/100 Readiness Evaluation','','- Exact execution SHA: '+evaluation.sha,'- All agents 100/100: '+(evaluation.all100?'YES':'NO'),' - Behavioral evidence: UNPROVEN'.replace(' -','-'),'','| Agent | Score | Drill | Negative cases | Result |','|---|---:|---|---:|---|'];
  for(const r of evaluation.results){ lines.push('| '+r.name+' | '+r.score+'/100 | '+r.drill.validScore+'/100 | '+r.drill.negativeRejected+' | '+(r.passed?'PASS':'TRAIN')+' |'); }
  lines.push('','## Remediation');
  for(const r of evaluation.results.filter(x=>!x.passed)){ lines.push('', '### '+r.name); for(const c of r.checks.filter(x=>!x.ok)) lines.push('- '+c.label+' — '+c.remediation); }
  lines.push('','100/100 here means the role contract and deterministic capability exam are complete. It does not impersonate a real model run. Behavioral evidence remains UNPROVEN until the real agent executes a task.');
  return lines.join('\n')+'\n';
}

function main(){
  const sha=process.argv[2] ?? process.env.GITHUB_SHA ?? gitHead();
  const evaluation=evaluateAllAgents(sha);
  const output='الوكلاء/تدريب الوكلاء/تقارير التدريب/'+sha+'-readiness.md';
  mkdirSync(join(ROOT,'الوكلاء/تدريب الوكلاء/تقارير التدريب'),{recursive:true});
  writeFileSync(join(ROOT,output),renderReadinessReport(evaluation),'utf8');
  console.log(JSON.stringify(evaluation,null,2));
  if(!evaluation.all100) process.exitCode=1;
}

if(process.argv[1]?.endsWith('evaluate-agent-readiness.mjs')) main();