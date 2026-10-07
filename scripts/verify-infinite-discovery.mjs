import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const required=[
  ".agent-intelligence/schemas/proposal.schema.yml",
  ".agent-intelligence/schemas/snapshot.schema.yml",
  ".agent-intelligence/scripts/fetch_snapshot.py",
  ".agent-intelligence/scripts/run_scouts.py",
  ".agent-intelligence/scouts/architecture.yaml",
  ".agent-intelligence/scouts/technology.yaml",
  ".agent-intelligence/scouts/ecosystem.yaml",
  ".agent-intelligence/inbox",
  "الوكلاء/التقارير/AGENT-08 — Architecture Scout",
  "الوكلاء/التقارير/AGENT-09 — Technology Scout",
  "الوكلاء/التقارير/AGENT-10 — Ecosystem Scout",
  ".agent-intelligence/snapshots",
  ".github/workflows/continuous-discovery.yml"
];
function fail(m){console.error("INFINITE_DISCOVERY_FAIL: "+m);process.exit(1);}
function exists(p){try{statSync(join(root,p));return true;}catch{return false;}}
for(const p of required) if(!exists(p)) fail("missing: "+p);

for(const p of [
  ".agent-intelligence/scouts/architecture.yaml",
  ".agent-intelligence/scouts/technology.yaml",
  ".agent-intelligence/scouts/ecosystem.yaml"
]){
  let data;
  try{data=JSON.parse(readFileSync(join(root,p),"utf8"));}catch{fail("manifest is not valid YAML/JSON-subset: "+p);}
  if(data.format!=="flixo-scout-manifest-v1") fail("invalid manifest format: "+p);
  if(!["ARCHITECTURE","TECHNOLOGY","ECOSYSTEM"].includes(data.role)) fail("invalid Scout role: "+p);
  if(!Array.isArray(data.sources)||data.sources.length===0) fail("manifest has no sources: "+p);
  for(const s of data.sources){
    for(const field of ["url","title","entity_key","repo_refs","proposal","rollback","source_type","stability","evidence_kind"]) if(!(field in s)) fail(p+": missing source field "+field);
    if(!/^https?:\/\//.test(s.url)) fail(p+": source URL must be http(s)");
    if(!Array.isArray(s.repo_refs)||s.repo_refs.length===0) fail(p+": repo_refs missing");
    for(const ref of s.repo_refs){
      const target=join(root,ref.split(":",1)[0]);
      if(!exists(ref) || statSync(target).isSymbolicLink()) fail(p+": invalid repo ref "+ref);
    }
    if(!String(s.rollback).trim()) fail(p+": empty rollback");
    if(!String(s.entity_key).match(/^[a-z0-9][a-z0-9._:/-]{1,127}$/)) fail(p+": invalid entity_key");
  }
}
const profiles=[
  ".github/agents/flixo-scout-architecture.agent.md",
  ".github/agents/flixo-scout-technology.agent.md",
  ".github/agents/flixo-scout-ecosystem.agent.md"
];
for(const p of profiles){
  const c=readFileSync(join(root,p),"utf8");
  if(!c.includes('tools: ["read", "search", "edit"]')) fail("Scout tool contract: "+p);
  if(!c.includes("cap_WRITE_REPORTS: SCOPED")) fail("Scout report capability missing: "+p);
  if(!c.includes("cap_WRITE_INBOX: DENY")) fail("Scout inbox capability must be denied: "+p);
  const scope=c.match(/^write_scope:\s*(.+)$/mu)?.[1]?.trim();
  const reportScope=c.match(/^report_scope:\s*(.+)$/mu)?.[1]?.trim();
  if(!scope || !reportScope || scope!==reportScope || !scope.startsWith("الوكلاء/التقارير/")) fail("Scout report scope invalid: "+p);
  if(scope.includes(".agent-intelligence/inbox/")) fail("Scout report scope may not use inbox: "+p);
  if(/Your only writable repository path is \.agent-intelligence\/inbox\./u.test(c)) fail("stale inbox write contract remains: "+p);
  if(/writable.*(?:review-queue|التطوير\.md)/iu.test(c)) fail("Scout grants forbidden writable surface: "+p);
}
}
for(const f of readdirSync(join(root,".agent-intelligence","inbox"))) if(f!==".gitkeep"&&f!=="README.md") fail("inbox is deny-only; unexpected artifact: "+f);
for(const f of readdirSync(join(root,".agent-intelligence","snapshots"))) if(!f.endsWith(".json")&&!f.endsWith(".raw")&&!f.endsWith(".txt")&&f!==".gitkeep"&&f!=="README.md") fail("invalid snapshot artifact: "+f);
const workflow=readFileSync(join(root,".github/workflows/continuous-discovery.yml"),"utf8");
if(!workflow.includes("schedule:")||!workflow.includes("workflow_dispatch:")||!workflow.includes("pull_request:")) fail("workflow triggers incomplete");
if(!workflow.includes("permissions:\n  contents: read")) fail("workflow default permission must be read");
if(!workflow.includes("contents: write")) fail("publish job write permission missing");
if(!workflow.includes("scout/discovery-")) fail("publication must target scout/discovery-*");
if(!workflow.includes("الوكلاء/التقارير/AGENT-08 — Architecture Scout/*.yaml")) fail("Architecture report publication path missing");
if(!workflow.includes("الوكلاء/التقارير/AGENT-09 — Technology Scout/*.yaml")) fail("Technology report publication path missing");
if(!workflow.includes("الوكلاء/التقارير/AGENT-10 — Ecosystem Scout/*.yaml")) fail("Ecosystem report publication path missing");
if(workflow.match(/\.agent-intelligence\/inbox\/\*\.ya?ml/)) fail("forbidden inbox proposal publication remains");
if(workflow.match(/git add \.agent-intelligence\/inbox\b/)) fail("forbidden inbox staging remains");
if(workflow.match(/git push origin (main|execution)\b/)) fail("forbidden main/execution push path");
console.log("INFINITE_DISCOVERY=PASS");
