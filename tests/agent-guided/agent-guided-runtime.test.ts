import assert from "node:assert/strict";
import test from "node:test";
import { confirmAgentPlan, executeAgentPlan, planAgentRequest } from "../../src/lib/agent-guided-runtime.ts";

test("Agent Guided produces a structured executable intent and one canonical step", () => {
  const file = new File(["fixture"], "image.png", { type: "image/png" });
  const plan = planAgentRequest("remove background", file);
  assert.equal(plan.structuredIntent.capabilityId, "background-remover");
  assert.equal(plan.structuredIntent.source, "deterministic-local-parser");
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.requiresUserConfirmation, true);
});

test("Agent Guided accepts representative Arabic video trim intent", () => {
  const file = new File(["fixture"], "video.webm", { type: "video/webm" });
  const plan = planAgentRequest("اقتطع أول 1 ثانية من الفيديو", file);
  assert.equal(plan.structuredIntent.capabilityId, "video-trimmer");
  assert.equal(plan.steps[0]?.params?.endSec, 1);
});

test("Changing intent invalidates old plan and confirmation for the same file", () => {
  const file = new File(["fixture"], "image.png", { type: "image/png" });
  const oldPlan = planAgentRequest("remove background", file);
  const receipt = confirmAgentPlan(oldPlan, file);
  const newerPlan = planAgentRequest("compress image", file);
  assert.notEqual(oldPlan, newerPlan);
  assert.throws(() => confirmAgentPlan(oldPlan, file), /superseded/i);
  return assert.rejects(() => executeAgentPlan(oldPlan, file, receipt), /missing|stale|superseded|bound/i);
});

test("Forged provider-style plans never become execution authority", async () => {
  const file = new File(["fixture"], "image.png", { type: "image/png" });
  const plan = planAgentRequest("remove background", file);
  const receipt = confirmAgentPlan(plan, file);
  const forged = Object.freeze({ ...plan, steps: [{ toolId: "video-compressor", params: {} }] }) as typeof plan;
  assert.throws(() => confirmAgentPlan(forged, file), /denied|issued/i);
  await assert.rejects(() => executeAgentPlan(forged, file, receipt), /denied|stale|bound/i);
});

test("Confirmation receipt is consumed before canonical execution is attempted", async () => {
  const file = new File(["fixture"], "image.png", { type: "image/png" });
  const plan = planAgentRequest("remove background", file);
  const receipt = confirmAgentPlan(plan, file);
  await assert.rejects(() => executeAgentPlan(plan, file, receipt), /denied|file|signature|dimensions|safety/i);
  await assert.rejects(() => executeAgentPlan(plan, file, receipt), /missing|stale|bound/i);
});
