import assert from "node:assert/strict";
import test from "node:test";
import { auditActivityLogs, validateExperienceEventSequence } from "../../../scripts/agent-activity-ledger.mjs";

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

  
test('experience lifecycle is ordered, complete, and explicit', () => {
  assert.equal(validateExperienceEventSequence([
    'START','MEMORY-PREFLIGHT','OBSERVE','ACT','VERIFY','LEARN-PROPOSE','HANDOFF'
  ]), true);
  assert.throws(() => validateExperienceEventSequence([
    'START','OBSERVE','ACT','MEMORY-PREFLIGHT','VERIFY','LEARN-PROPOSE','HANDOFF'
  ]), /out of order/);
  assert.throws(() => validateExperienceEventSequence(['START','OBSERVE','HANDOFF']), /missing/);
});
