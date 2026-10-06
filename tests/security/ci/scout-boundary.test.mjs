import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("three Scout profiles are read/search/edit only", () => {
  for (const file of [
    ".github/agents/flixo-scout-architecture.agent.md",
    ".github/agents/flixo-scout-technology.agent.md",
    ".github/agents/flixo-scout-ecosystem.agent.md"
  ]) {
    const content = readFileSync(file, "utf8");
    assert.match(content, /tools: \["read", "search", "edit"\]/);
    assert.match(content, /target: github-copilot/);
    assert.match(content, /disable-model-invocation: true/);
    assert.match(content, /Your only writable repository file is التطوير\.md\./);
    const tools = content.split("\n").find((line) => line.startsWith("tools:")) ?? "";
    assert.doesNotMatch(tools, /execute|shell|bash|powershell|terminal|agent|web/);
  }
});

test("development radar is advisory data with isolated sections", () => {
  const content = readFileSync("التطوير.md", "utf8");
  assert.match(content, /TYPE: DATA ONLY/);
  assert.match(content, /## Architecture Radar/);
  assert.match(content, /## Technology Radar/);
  assert.match(content, /## Ecosystem Radar/);
  assert.match(content, /## Executor Handoff Contract/);
});
