import assert from "node:assert/strict";
import test from "node:test";
import {
  CALL_MODEL_CATALOG,
  getCallAgentModel,
  listCallAgentAssignments,
  routeCallTask,
} from "../../packages/contracts/src/index.ts";

test("CALL has the complete declared model pool", () => {
  assert.equal(CALL_MODEL_CATALOG.length, 57);
  assert.equal(new Set(CALL_MODEL_CATALOG.map((m) => m.modelId)).size, 57);
});

test("GLM-5.3 is the sole CALL Master", () => {
  assert.equal(getCallAgentModel("master")?.modelId, "GLM-5.3");
  assert.equal(routeCallTask({
    taskId: "mission-1",
    kind: "plan",
    requiredCapabilities: ["reasoning", "planning"],
  }).modelId, "GLM-5.3");
});

test("tasks are routed to specialized agents", () => {
  assert.equal(routeCallTask({taskId:"b",kind:"build",requiredCapabilities:["coding"]}).agentId, "builder");
  assert.equal(routeCallTask({taskId:"o",kind:"oppose",requiredCapabilities:["falsification"]}).agentId, "opponent");
  assert.equal(routeCallTask({taskId:"r",kind:"red-team",requiredCapabilities:["coding"]}).agentId, "adversary-builder");
  assert.equal(routeCallTask({taskId:"e",kind:"explore",requiredCapabilities:["research"]}).agentId, "explorer");
  assert.equal(routeCallTask({taskId:"v",kind:"verify",requiredCapabilities:["analysis"]}).agentId, "verifier");
  assert.equal(routeCallTask({taskId:"x",kind:"vision",requiredCapabilities:["OCR"]}).agentId, "vision");
});

test("routing fails closed when no model satisfies the contract", () => {
  assert.throws(() => routeCallTask({
    taskId: "nope",
    kind: "build",
    requiredCapabilities: ["capability-that-does-not-exist"],
  }), /CALL_ROUTING_NO_CAPABLE_MODEL/);
});

test("agent roster is explicit and the second agent is the independent opponent", () => {
  const roster = listCallAgentAssignments();
  assert.equal(roster[0]?.agentId, "master");
  assert.equal(roster[0]?.preferredModel, "GLM-5.3");
  assert.equal(roster[1]?.agentId, "opponent");
  assert.notEqual(roster[1]?.preferredModel, "GLM-5.3");
  assert.equal(getCallAgentModel("opponent")?.roles.includes("master"), false);
  assert.ok(roster.some((x) => x.agentId === "builder"));
  assert.ok(roster.some((x) => x.agentId === "verifier"));
});
