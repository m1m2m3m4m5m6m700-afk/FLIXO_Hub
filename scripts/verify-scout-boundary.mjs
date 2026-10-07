import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const agentsDir=join(root,".github","agents");
const reportCenter=join(root,"الوكلاء","التقارير");
const canonicalPackages={
  "flixo-scout-architecture.agent.md":"الوكلاء/المستكشفين/Architecture Scout/المستكشف.md",
  "flixo-scout-technology.agent.md":"الوكلاء/المستكشفين/Technology Scout/المستكشف.md",
  "flixo-scout-ecosystem.agent.md":"الوكلاء/المستكشفين/Ecosystem Scout/المستكشف.md",
};
const scouts={
  "flixo-scout-architecture.agent.md":"FLIXO Architecture Scout",
  "flixo-scout-technology.agent.md":"FLIXO Technology Scout",
  "flixo-scout-ecosystem.agent.md":"FLIXO Ecosystem Scout",
};

function fail(message){console.error("SCOUT_BOUNDARY_FAIL: "+message);process.exit(1);}
function exists(path){try{statSync(path);return true;}catch{return false;}}

if(!exists(agentsDir)) fail("missing .github/agents");
if(!exists(reportCenter)) fail("missing canonical report center");

for(const [file,role] of Object.entries(scouts)){
  const path=join(agentsDir,file);
  if(!exists(path)) fail("missing profile: "+file);
  const content=readFileSync(path,"utf8");
  if(!content.startsWith("---\n")) fail(file+": missing frontmatter");
  if(!content.includes('tools: ["read", "search", "edit"]')) fail(file+": tools must be exactly read/search/edit");
  if(!content.includes("target: github-copilot")) fail(file+": wrong target");
  if(!content.includes("disable-model-invocation: true")) fail(file+": automatic invocation must be disabled");
  const scope=content.match(/^write_scope:\s*(.+)$/mu)?.[1]?.trim();
  const reportScope=content.match(/^report_scope:\s*(.+)$/mu)?.[1]?.trim();
  if(!scope || !reportScope) fail(file+": missing report/write scope");
  if(scope!==reportScope) fail(file+": write_scope and report_scope must match");
  if(!scope.startsWith("الوكلاء/التقارير/")) fail(file+": writable path must use canonical report center");
  if(scope.includes(".agent-intelligence/inbox/")) fail(file+": inbox is forbidden");
  if(!content.includes("cap_WRITE_REPORTS: SCOPED")) fail(file+": WRITE_REPORTS must be SCOPED");
  if(!content.includes("cap_WRITE_INBOX: DENY")) fail(file+": WRITE_INBOX must be DENY");
  if(!content.includes(role)) fail(file+": missing role identity");
  const canonical=join(root,canonicalPackages[file]);
  if(!exists(canonical)) fail(file+": missing canonical package file");
  if(!content.includes(canonicalPackages[file].replace("/المستكشف.md","/"))) fail(file+": missing canonical package reference");
  if(/writ(?:e|able).*?\.agent-intelligence\/inbox\//iu.test(content)) fail(file+": forbidden inbox write boundary");
  if(/writ(?:e|able).*?(?:\.agent-intelligence\/review-queue|التطوير\.md)/iu.test(content)) fail(file+": forbidden writable surface");
  const reportDir=join(root,scope);
  if(!exists(reportDir)) fail(file+": canonical report directory missing");
}

const raw=process.env.SCOUT_CHANGED_FILES;
if(raw){
  if((process.env.SCOUT_BASE_BRANCH||"")!=="execution") fail("Scout PR must target execution");
  for(const path of raw.split("\n").map(x=>x.trim()).filter(Boolean)){
    if(!path.startsWith("الوكلاء/التقارير/AGENT-08 — ") &&
       !path.startsWith("الوكلاء/التقارير/AGENT-09 — ") &&
       !path.startsWith("الوكلاء/التقارير/AGENT-10 — ")){
      fail("forbidden Scout changed path: "+path);
    }
  }
}
console.log("SCOUT_BOUNDARY=PASS");
