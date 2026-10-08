import test from "node:test";
import assert from "node:assert/strict";
import { admitExecution } from "../src/lib/cell/hard-control.ts";

const authority = {
  agentId: "test-agent",
  role: "assistant" as const,
  capabilities: ["image-upscaler"],
  scopes: ["media:local"],
};

test("CELL admits only a canonical executable local capability", () => {
  const result = admitExecution({
    requestId: "req-1",
    taskId: "task-1",
    capabilityId: "image-upscaler",
    scope: "media:local",
    authority,
    maxAttempts: 3,
  });
  assert.equal(result.decision, "ALLOW");
});

test("CELL fails closed for unknown capability", () => {
  const result = admitExecution({
    requestId: "req-2",
    taskId: "task-2",
    capabilityId: "not-canonical",
    scope: "media:local",
    maxAttempts: 1,
  });
  assert.equal(result.decision, "DENY");
  if (result.decision === "DENY") assert.equal(result.code, "UNKNOWN_CAPABILITY");
});

test("CELL rejects capability outside delegated authority", () => {
  const result = admitExecution({
    requestId: "req-3",
    taskId: "task-3",
    capabilityId: "image-upscaler",
    scope: "media:local",
    authority: { ...authority, capabilities: [] },
    maxAttempts: 1,
  });
  assert.equal(result.decision, "DENY");
});

test("CELL rejects retry and chain budget escalation", () => {
  const retry = admitExecution({
    requestId: "req-4",
    taskId: "task-4",
    capabilityId: "image-upscaler",
    scope: "media:local",
    maxAttempts: 99,
  });
  assert.equal(retry.decision, "DENY");

  const chain = admitExecution({
    requestId: "req-5",
    taskId: "task-5",
    capabilityId: "image-upscaler",
    scope: "media:local",
    maxAttempts: 1,
    chainDepth: 5,
  });
  assert.equal(chain.decision, "DENY");
});

test("CELL rejects an already-aborted execution", () => {
  const controller = new AbortController();
  controller.abort();
  const result = admitExecution({
    requestId: "req-6",
    taskId: "task-6",
    capabilityId: "image-upscaler",
    scope: "media:local",
    maxAttempts: 1,
    signal: controller.signal,
  });
  assert.equal(result.decision, "DENY");
});
