import test from "node:test";
import assert from "node:assert/strict";
import { canTransition, transitionCell } from "../src/lib/cell/lifecycle.ts";
import { bindExecutionEvidence, assertExecutionEvidence } from "../src/lib/cell/evidence.ts";

test("CELL lifecycle is fail-closed and terminal states cannot reopen", () => {
  assert.equal(canTransition("ADMITTED", "RUNNING"), true);
  assert.equal(canTransition("RUNNING", "VERIFYING"), true);
  assert.equal(canTransition("VERIFYING", "VERIFIED"), true);
  assert.equal(canTransition("VERIFIED", "RUNNING"), false);
  assert.throws(() => transitionCell("VERIFIED", "RUNNING"), /transition denied/i);
});

test("CELL binds evidence to execution identity and artifact digests", async () => {
  const evidence = await bindExecutionEvidence(
    { requestId: "req-1", taskId: "task-1", capabilityId: "image-upscaler", policyFingerprint: "policy-1" },
    new Blob(["input"]),
    new Blob(["output"]),
  );
  assert.equal(evidence.schemaVersion, 1);
  assert.match(evidence.inputSha256, /^[0-9a-f]{64}$/);
  assert.match(evidence.outputSha256, /^[0-9a-f]{64}$/);
  assert.doesNotThrow(() => assertExecutionEvidence(evidence));
  assert.throws(
    () => assertExecutionEvidence({ ...evidence, outputSha256: "forged" }),
    /invalid SHA-256/i,
  );
});
