import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
const START = "<!-- CANONICAL_AGENT_REGISTRY:START -->";
const END = "<!-- CANONICAL_AGENT_REGISTRY:END -->";
function loadRegistry() {
  const content = readFileSync("الوكلاء.md", "utf8");
  const start = content.indexOf(START);
  const end = content.indexOf(END);
  assert.ok(start >= 0 && end > start);
  const block = content.slice(start + START.length, end);
  const jsonStart = block.indexOf("```json");
  const jsonEnd = block.indexOf("```", jsonStart + 7);
  assert.ok(jsonStart >= 0 && jsonEnd > jsonStart);
  return JSON.parse(block.slice(jsonStart + 7, jsonEnd).trim());
}
test("canonical registry defines exactly ten principal agents", () => {
  const r = loadRegistry();
  assert.equal(r.officialAgentCount, 10);
  assert.equal(r.agents.length, 10);
  assert.deepEqual(r.agents.map(a => a.id), Array.from({length: 10}, (_, i) => "AGENT-" + String(i + 1).padStart(2, "0")));
  assert.equal(new Set(r.agents.map(a => a.profile)).size, 10);
});
test("supporting explorer-2 is explicit and excluded from the ten", () => {
  const r = loadRegistry();
  assert.equal(r.supportingRoles.length, 1);
  assert.equal(r.supportingRoles[0].id, "SUPPORT-EXPLORER-02");
  assert.equal(r.supportingRoles[0].countedInOfficialTen, false);
});
test("registration layer exactly matches canonical profiles", () => {
  const r = loadRegistry();
  const expected = [...r.agents, ...r.supportingRoles].map(a => a.profile.split("/").pop()).sort();
  const actual = readdirSync(".github/agents").filter(name => name.endsWith(".md")).sort();
  assert.deepEqual(actual, expected);
});
test("every registered profile points to the canonical file", () => {
  const r = loadRegistry();
  for (const agent of [...r.agents, ...r.supportingRoles]) assert.ok(readFileSync(agent.profile, "utf8").includes("Canonical registry: الوكلاء.md"), agent.id);
});
