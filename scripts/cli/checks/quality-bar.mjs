import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const REQUIRED_SCRIPTS = ['test','build','test:e2e','verify:all','verify:quality','audit:production'];
const REQUIRED_FILES = [
  '.github/workflows/ci.yml','.github/workflows/codeql.yml','.github/workflows/secret-scan.yml',
  '.github/CODEOWNERS','SECURITY.md','src/lib/contracts/upload-boundary.ts',
  'src/lib/contracts/browser-file-safety.ts','src/lib/tools/tool-registry.ts',
  'docs/QUALITY-BAR.md','docs/OPERATIONS.md','docs/adr/0001-engineering-source-of-truth.md',
  'docs/attestations/FLIXO-EXACT-SHA-CERTIFICATION.md',
  'docs/attestations/FLIXO-FINAL-CERTIFICATION-ATTESTATION.md',
  'docs/attestations/THREE-CRITIC-REVIEW.md',
];
const REQUIRED_OWNERSHIP = [
  '/.github/workflows/','/scripts/cli/','/src/lib/contracts/','/src/worker.ts',
  '/wrangler.jsonc','/package.json','/package-lock.json','/SECURITY.md','/docs/attestations/',
];
const MODULE_BUDGETS = [
  { prefix:'src/lib/tools/tool-registry.ts', maxBytes:50_000 },
  { prefix:'src/tools/', suffix:'/locales.ts', maxBytes:65_000, exactSuffix:true },
  { prefix:'src/tools/', suffix:'.tsx', maxBytes:40_000 },
  { prefix:'src/tools/', suffix:'.ts', maxBytes:40_000 },
  { prefix:'src/components/', suffix:'.tsx', maxBytes:32_000 },
  { prefix:'src/lib/i18n/', suffix:'.ts', maxBytes:60_000 },
  { prefix:'src/data/', suffix:'.ts', maxBytes:55_000 },
  { prefix:'src/config/', suffix:'.ts', maxBytes:55_000 },
  { prefix:'src/lib/video/', suffix:'.ts', maxBytes:20_000 },
];
const RESOURCE_CONTRACTS = {
  'src/tools/image-toolkit/engine.ts': [/URL\.revokeObjectURL\(/u,/canvas\.width\s*=\s*0/u,/canvas\.height\s*=\s*0/u],
  'src/tools/_shared/image-effects-worker.ts': [/image\.close\(\)/u,/canvas\.width\s*=\s*0/u,/canvas\.height\s*=\s*0/u],
  'src/tools/image-compressor/compressor.worker.ts': [/canvas\.width\s*=\s*0/u,/canvas\.height\s*=\s*0/u],
  'src/lib/video/video-executor.ts': [/URL\.revokeObjectURL\(/u,/getTracks\(\)/u,/cancelAnimationFrame\(/u,/canvas\.width\s*=\s*0/u],
  'src/tools/video-local/index.tsx': [/URL\.revokeObjectURL\(/u,/AbortController\b/u],
};
function readJson(root,file){ return JSON.parse(readFileSync(resolve(root,file),'utf8')); }
function walk(root,dir,output=[]){
  const absolute=resolve(root,dir); if(!existsSync(absolute)) return output;
  for(const entry of readdirSync(absolute)){ const path=join(absolute,entry); if(statSync(path).isDirectory()) walk(root,relative(root,path),output); else output.push(relative(root,path).replaceAll('\\','/')); }
  return output;
}
function checkModuleBudgets(root){
  const files=walk(root,'src'), violations=[], measured={};
  for(const path of files){
    const budget=MODULE_BUDGETS.find(candidate=>{
      if(!path.startsWith(candidate.prefix)) return false;
      if(candidate.exactSuffix) return path.endsWith(candidate.suffix);
      return !candidate.suffix || path.endsWith(candidate.suffix);
    });
    if(!budget) continue;
    const bytes=statSync(resolve(root,path)).size;
    measured[path]={bytes,maxBytes:budget.maxBytes};
    if(bytes>budget.maxBytes) violations.push(path+': '+bytes+' > '+budget.maxBytes+' byte budget');
  }
  return {violations,measured};
}
export function collectQualityBarReport(root=process.cwd()){
  const pkg=readJson(root,'package.json'), tsconfig=readJson(root,'tsconfig.json');
  const owners=readFileSync(resolve(root,'.github/CODEOWNERS'),'utf8'), checks={};
  checks.package_scripts=REQUIRED_SCRIPTS.every(script=>typeof pkg.scripts?.[script]==='string')?'PASS':'FAIL';
  checks.typescript_strict=tsconfig.compilerOptions?.strict===true?'PASS':'FAIL';
  checks.registry_source_of_truth=existsSync(resolve(root,'src/lib/tools/tool-registry.ts'))?'PASS':'FAIL';
  checks.compatibility_facades=[
    'src/config/canonical-tool-definition.ts','src/config/manual-capability-definition.ts',
  ].every(path=>{
    const content=readFileSync(resolve(root,path),'utf8').trim();
    return Buffer.byteLength(content,'utf8')<=512 && /export \* from ['"]\.\.\/lib\/tools\/tool-registry\.ts['"]/.test(content);
  })?'PASS':'FAIL';
  checks.required_files=REQUIRED_FILES.every(path=>existsSync(resolve(root,path)))?'PASS':'FAIL';
  checks.security_ownership=REQUIRED_OWNERSHIP.every(path=>owners.split(/\r?\n/u).some(line=>line.trim().startsWith(path+' ')))?'PASS':'FAIL';
  const resourceFailures=[];
  for(const [path,patterns] of Object.entries(RESOURCE_CONTRACTS)){
    const content=readFileSync(resolve(root,path),'utf8');
    for(const pattern of patterns) if(!pattern.test(content)) resourceFailures.push(path+': missing '+pattern);
  }
  checks.resource_lifecycle=resourceFailures.length===0?'PASS':'FAIL';
  const budgetReport=checkModuleBudgets(root);
  checks.module_budgets=budgetReport.violations.length===0?'PASS':'FAIL';
  return {status:Object.values(checks).every(value=>value==='PASS')?'PASS':'FAIL',checks,moduleBudgets:budgetReport.measured,failures:resourceFailures.concat(budgetReport.violations)};
}
export function runQualityBarCheck(root=process.cwd()){
  const report=collectQualityBarReport(root);
  if(report.status!=='PASS'){ const error=new Error('Engineering quality bar failed.'); error.failures=report.failures; error.checks=report.checks; throw error; }
  console.log('ENGINEERING_QUALITY_BAR=PASS'); console.log(JSON.stringify(report.checks)); return report;
}
