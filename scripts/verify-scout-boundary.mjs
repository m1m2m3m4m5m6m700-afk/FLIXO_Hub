import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const agentsDir=join(root,".github","agents");
const inboxDir=join(root,".agent-intelligence","inbox");
const snapshotsDir=join(root,".agent-intelligence","snapshots");
const scouts={
  "flixo-scout-architecture.agent.md":"FLIXO Architecture Scout",
  "flixo-scout-technology.agent.md":"FLIXO Technology Scout",
  "flixo-scout-ecosystem.agent.md":"FLIXO Ecosystem Scout",
};

function fail(message){console.error("SCOUT_BOUNDARY_FAIL: "+message);process.exit(1);}
function exists(path){try{statSync(path);return true;}catch{return false;}}

if(!exists(agentsDir)) fail("missing .github/agents");
for(const [file,role] of Object.entries(scouts)){
  const path=join(agentsDir,file);
  if(!exists(path)) fail("missing profile: "+file);
  const content=readFileSync(path,"utf8");
  if(!content.startsWith("---\n")) fail(file+": missing frontmatter");
  if(!content.includes('tools: ["read", "search", "edit"]')) fail(file+": tools must be exactly read/search/edit");
  if(!content.includes("target: github-copilot")) fail(file+": wrong target");
  if(!content.includes("disable-model-invocation: true")) fail(file+": automatic invocation must be disabled");
  if(!content.includes("Your only writable repository path is .agent-intelligence/inbox/.")) fail(file+": missing inbox write boundary");
  if(!content.includes(role)) fail(file+": missing role identity");
  if(/Your only writable repository path is (?!\.agent-intelligence\/inbox\/)/u.test(content)) fail(file+": writable path must be inbox");
  if(/writ(?:e|able).*?(?:\.agent-intelligence\/review-queue|التطوير\.md)/iu.test(content)) fail(file+": forbidden writable surface");
}
if(!exists(inboxDir)||!exists(snapshotsDir)) fail("missing discovery directories");
for(const file of readdirSync(inboxDir)) if(!file.endsWith(".yaml")&&file!==".gitkeep"&&file!=="README.md") fail("unexpected inbox artifact: "+file);

const raw=process.env.SCOUT_CHANGED_FILES;
if(raw){
  if((process.env.SCOUT_BASE_BRANCH||"")!=="execution") fail("Scout PR must target execution");
  for(const path of raw.split("\n").map(x=>x.trim()).filter(Boolean)){
    if(!((path.startsWith(".agent-intelligence/inbox/")&&path.endsWith(".yaml"))||(path.startsWith(".agent-intelligence/snapshots/")&&(path.endsWith(".json")||path.endsWith(".raw")||path.endsWith(".txt"))))){
      fail("forbidden Scout changed path: "+path);
    }
  }
}
console.log("SCOUT_BOUNDARY=PASS");
