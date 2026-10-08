import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(import.meta.dirname,"..");
const source=readFileSync(resolve(root,"wrangler.toml"),"utf8");
const must=[
["name = \"flixo-agent-watchdog\"","worker name"],["main = \"src/index.ts\"","worker main"],
["compatibility_date = \"2026-10-07\"","compatibility date"],["cpu_ms = 1000","CPU bound"],["subrequests = 10","subrequest bound"],
["GITHUB_REPOSITORY = \"m1m2m3m4m5m6m700-afk/FLIXO_Hub\"","canonical repository"],
["GITHUB_DISPATCH_WORKFLOW = \"agent-runner.yml\"","canonical workflow"],["GITHUB_DISPATCH_REF = \"execution\"","canonical ref"],
["[[durable_objects.bindings]]","Durable Object binding"],["name = \"AGENT_STATE\"","AgentState binding"],
["class_name = \"AgentState\"","AgentState class"],["[[migrations]]","migration"],["tag = \"v1\"","migration tag"],
["new_sqlite_classes = [\"AgentState\"]","AgentState migration"]];
for(const [value,label] of must) if(!source.includes(value)) throw new Error("WRANGLER_INVALID:"+label);
if(source.includes("[build]")||/\\b(?:wrangler\\s+)?deploy\\b/i.test(source)||/\\bgit\\s+(?:push|merge|rebase|reset|checkout|switch)\\b/i.test(source)) throw new Error("WRANGLER_UNSAFE_COMMANDS");
if(/^\\s*(?:AGENT_TOKEN|AGENT_TOKEN_PREV|ADMIN_TOKEN|GITHUB_TOKEN)\\s*=/m.test(source)) throw new Error("WRANGLER_SECRET_EMBEDDED");
const workflow=source.match(/^GITHUB_DISPATCH_WORKFLOW = "([^"]+)"$/m)?.[1]??"";
const ref=source.match(/^GITHUB_DISPATCH_REF = "([^"]+)"$/m)?.[1]??"";
if(!/^[A-Za-z0-9_.\\/-]+$/.test(workflow)||workflow.includes("..")||workflow.startsWith("/")||workflow.endsWith("/")) throw new Error("WRANGLER_UNSAFE_WORKFLOW");
if(!/^[A-Za-z0-9_.\\/-]+$/.test(ref)||ref.includes("..")||ref.startsWith("/")||ref.endsWith("/")) throw new Error("WRANGLER_UNSAFE_REF");
if(/[*~^<>=|&;]/.test(workflow+ref)) throw new Error("WRANGLER_FLOATING_WORKFLOW");
console.log("WATCHDOG_WRANGLER=PASS");
