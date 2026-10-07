import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const source = readFileSync("الوكلاء.md", "utf8");
const start = source.indexOf("<!-- CANONICAL_AGENT_REGISTRY:START -->");
const end = source.indexOf("<!-- CANONICAL_AGENT_REGISTRY:END -->", start);
assert.ok(start >= 0 && end > start, "canonical registry markers missing");
const block = source.slice(start, end);
const jsonStart = block.indexOf("```json");
const jsonEnd = block.indexOf("```", jsonStart + 7);
const registry = JSON.parse(block.slice(jsonStart + 7, jsonEnd).trim());

assert.equal(registry.reportCenter, "الوكلاء/التقارير/");
assert.ok(!registry.reportCenter.includes(".agent-intelligence/inbox/"));

for (const agent of [...(registry.agents ?? []), ...(registry.supportingRoles ?? [])]) {
  assert.equal(agent.report.includes(".agent-intelligence/inbox/"), false, agent.id + ": report may not use inbox");
  assert.ok(agent.report.startsWith("الوكلاء/التقارير/"), agent.id + ": report must live under central report center");
  assert.ok(existsSync(agent.report), agent.id + ": canonical report directory must exist");
}

for (const id of ["AGENT-08", "AGENT-09", "AGENT-10"]) {
  const agent = registry.agents.find(item => item.id === id);
  assert.ok(agent);
  assert.equal(agent.report.includes(".agent-intelligence/inbox/"), false);
}

