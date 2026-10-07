import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { auditActivityLogs } from "../../../scripts/agent-activity-ledger.mjs";

test("all registered agents have fail-closed append-only activity logs", () => {
  const result = auditActivityLogs();
  assert.equal(result.protocol, "flixo-agent-activity-v1");
  assert.equal(result.agentCount, 15);
  assert.deepEqual(result.failures, []);
  assert.equal(result.status, "PASS");
});

test("activity log protocol forbids untracked completion semantics", async () => {
  const registry = readFileSync("الوكلاء.md", "utf8");
  assert.match(registry, /## 26\. بروتوكول التتبع الإلزامي/u);
  assert.match(registry, /TRACE-BLOCKED/u);
  assert.match(registry, /chain-of-thought الخاص/u);
});


test("scout activity logs live inside their agent packages, never the research inbox", () => {
  const source = readFileSync("الوكلاء.md", "utf8");
  assert.match(source, /"id": "AGENT-08"[\s\S]*?"activityLog": "الوكلاء AI\/المستكشفين\/Architecture Scout\/سجل النشاط\.md"/u);
  assert.match(source, /"id": "AGENT-09"[\s\S]*?"activityLog": "الوكلاء AI\/المستكشفين\/Technology Scout\/سجل النشاط\.md"/u);
  assert.match(source, /"id": "AGENT-10"[\s\S]*?"activityLog": "الوكلاء AI\/المستكشفين\/Ecosystem Scout\/سجل النشاط\.md"/u);
  assert.doesNotMatch(source, /"activityLog": "\.agent-intelligence\/inbox\/AGENT-0[89]__سجل التشغيل/u);
  assert.doesNotMatch(source, /"activityLog": "\.agent-intelligence\/inbox\/AGENT-10__سجل التشغيل/u);
});
