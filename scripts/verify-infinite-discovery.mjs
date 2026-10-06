import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
  if(!c.includes("Your only writable repository path is .agent-intelligence/inbox/.")) fail("Scout write boundary: "+p);
  if(/Your only writable repository path is (?!\.agent-intelligence\/inbox\/)/u.test(c)) fail("Scout writable path is not inbox: "+p);\n  if(/writable.*(?:review-queue|التطوير\.md)/iu.test(c)) fail("Scout grants forbidden writable surface: "+p);
}
for(const f of readdirSync(join(root,".agent-intelligence","inbox"))) if(!f.endsWith(".yaml")&&f!==".gitkeep"&&f!=="README.md") fail("invalid inbox artifact: "+f);
for(const f of readdirSync(join(root,".agent-intelligence","snapshots"))) if(!f.endsWith(".json")&&!f.endsWith(".raw")&&!f.endsWith(".txt")&&f!==".gitkeep"&&f!=="README.md") fail("invalid snapshot artifact: "+f);
const workflow=readFileSync(join(root,".github/workflows/continuous-discovery.yml"),"utf8");
if(!workflow.includes("schedule:")||!workflow.includes("workflow_dispatch:")||!workflow.includes("pull_request:")) fail("workflow triggers incomplete");
if(!workflow.includes("permissions:\n  contents: read")) fail("workflow default permission must be read");
if(!workflow.includes("contents: write")) fail("publish job write permission missing");
if(!workflow.includes("scout/discovery-")) fail("publication must target scout/discovery-*");
if(workflow.match(/git push origin (main|execution)\b/)) fail("forbidden main/execution push path");
console.log("INFINITE_DISCOVERY=PASS");
