import assert from "node:assert/strict";
import test from "node:test";
import { auditActivityLogs } from "../../../scripts/agent-activity-ledger.mjs";

test("all registered agents have fail-closed append-only activity logs", () => {
  const result = auditActivityLogs();
  assert.equal(result.protocol, "flixo-agent-activity-v1");
  assert.equal(result.agentCount, 11);
  assert.deepEqual(result.failures, []);
  assert.equal(result.status, "PASS");
});

test("activity log protocol forbids untracked completion semantics", async () => {
  const { readFileSync } = await import("node:fs");
  const registry = readFileSync("الوكلاء.md", "utf8");
  assert.match(registry, /## 26\. بروتوكول التتبع الإلزامي/u);
  assert.match(registry, /TRACE-BLOCKED/u);
  assert.match(registry, /chain-of-thought الخاص/u);
});
