import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
const registryPath = join(root, "الوكلاء.md");
const agentsDir = join(root, ".github", "agents");
const START = "<!-- CANONICAL_AGENT_REGISTRY:START -->";
const END = "<!-- CANONICAL_AGENT_REGISTRY:END -->";
function loadRegistry() {
  const content = readFileSync(registryPath, "utf8");
  const start = content.indexOf(START);
  const end = content.indexOf(END);
  if (start < 0 || end <= start) throw new Error("الوكلاء.md: canonical registry markers missing");
  const block = content.slice(start + START.length, end);
  const jsonStart = block.indexOf("```json");
  const jsonEnd = block.indexOf("```", jsonStart + 7);
  if (jsonStart < 0 || jsonEnd <= jsonStart) throw new Error("الوكلاء.md: canonical registry JSON missing");
  return JSON.parse(block.slice(jsonStart + 7, jsonEnd).trim());
}
const registry = loadRegistry();
if (registry.schema !== "flixo-canonical-agent-registry-v1") throw new Error("unsupported canonical agent registry schema");
if (registry.officialAgentCount !== 10) throw new Error("canonical official agent count must be 10");
if (!Array.isArray(registry.agents) || registry.agents.length !== 10) throw new Error("canonical registry must contain exactly 10 principal agents");
if (registry.agents.some((a, i) => a.id !== "AGENT-" + String(i + 1).padStart(2, "0"))) throw new Error("canonical IDs must be AGENT-01..AGENT-10");
if (new Set(registry.agents.map(a => a.id)).size !== 10) throw new Error("canonical agent IDs must be unique");
if (!Array.isArray(registry.supportingRoles) || registry.supportingRoles.length !== 1) throw new Error("supporting role registry must contain exactly one role");
const support = registry.supportingRoles[0];
if (support.id !== "SUPPORT-EXPLORER-02" || support.name !== "المستكشف 2" || support.countedInOfficialTen !== false) throw new Error("Explorer 2 must remain a supporting role");
const expected = [...registry.agents, ...registry.supportingRoles];
const expectedProfiles = expected.map(a => a.profile.split("/").pop());
const actualProfiles = readdirSync(agentsDir).filter(name => name.endsWith(".md"));
const missing = expectedProfiles.filter(name => !actualProfiles.includes(name));
const unexpected = actualProfiles.filter(name => !expectedProfiles.includes(name));
if (missing.length) throw new Error("missing canonical agent profiles: " + missing.join(", "));
if (unexpected.length) throw new Error("unregistered agent profiles: " + unexpected.join(", "));
for (const agent of expected) {
  const content = readFileSync(join(agentsDir, agent.profile.split("/").pop()), "utf8");
  if (!content.split(/\r?\n/u).includes("name: " + agent.name)) throw new Error(agent.id + ": profile name drift");
  if (!content.includes("100/100")) throw new Error(agent.id + ": missing 100/100 contract");
  if (!content.includes("Practical Mastery Loop")) throw new Error(agent.id + ": missing Practical Mastery Loop");
  if (!content.includes("Canonical registry: الوكلاء.md")) throw new Error(agent.id + ": missing canonical registry pointer");
  if (/git push origin main|force[- ]push|write directly to main/iu.test(content)) throw new Error(agent.id + ": forbidden main mutation language");
}
for (const id of ["AGENT-08", "AGENT-09", "AGENT-10"]) {
  const agent = registry.agents.find(a => a.id === id);
  const content = readFileSync(join(agentsDir, agent.profile.split("/").pop()), "utf8");
  if (!content.includes('tools: ["read", "search", "edit"]')) throw new Error(id + ": Scout tool boundary drift");
  if (!content.includes("only writable repository path is .agent-intelligence/inbox/")) throw new Error(id + ": Scout write boundary drift");
}
console.log("CANONICAL_AGENT_REGISTRY_OK=10 SUPPORTING=1 PROFILES=11");
