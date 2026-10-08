import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const scouts=[
  ".github/agents/flixo-scout-architecture.agent.md",
  ".github/agents/flixo-scout-technology.agent.md",
  ".github/agents/flixo-scout-ecosystem.agent.md",
];

test("Scout profiles are read/search/edit only and write to canonical reports",()=>{
  for(const file of scouts){
    const c=readFileSync(file,"utf8");
    assert.match(c,/tools: \["read", "search", "edit"\]/);
    assert.match(c,/write_scope: الوكلاء\/التقارير\/AGENT-(?:08|09|10) — .+\//u);
    assert.match(c,/report_scope: الوكلاء\/التقارير\/AGENT-(?:08|09|10) — .+\//u);
    assert.match(c,/cap_WRITE_REPORTS: SCOPED/u);
    assert.match(c,/cap_WRITE_INBOX: DENY/u);
    assert.match(c,/Never edit .*review-queue, .*التطوير\.md/u);
  }
});

test("continuous discovery has isolated validation and publication surfaces",()=>{
  const c=readFileSync(".github/workflows/continuous-discovery.yml","utf8");
  assert.match(c,/pull_request:/u);
  assert.match(c,/contents: read/u);
  assert.match(c,/contents: write/u);
  assert.match(c,/scout\/discovery-/u);
  assert.match(c,/الوكلاء\/التقارير\/AGENT-08 — Architecture Scout\/"?\*\.yaml/u);
  assert.match(c,/الوكلاء\/التقارير\/AGENT-09 — Technology Scout\/"?\*\.yaml/u);
  assert.match(c,/الوكلاء\/التقارير\/AGENT-10 — Ecosystem Scout\/"?\*\.yaml/u);
  assert.match(c,/.agent-intelligence\/snapshots\/\*\.json/u);
  assert.doesNotMatch(c,/.agent-intelligence\/inbox\/\*\.yaml/u);
  assert.doesNotMatch(c,/git push origin main|git push origin execution/u);
});
