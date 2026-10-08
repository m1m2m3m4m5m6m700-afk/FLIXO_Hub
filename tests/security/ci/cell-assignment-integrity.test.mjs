import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../../../" + path, import.meta.url), "utf8");

test("assignment architecture does not create a second dispatch authority", () => {
  const doc = read("docs/CELL-ASSIGNMENT-DELEGATION-CONTRACT.md");
  assert.match(doc, /المهام\.md يبقى Dispatch Authority الوحيد/);
  assert.match(doc, /Progress Ledger لا ينشئ Task/);
});

test("assignment contract exposes routing, delegation and progress primitives", () => {
  const source = read("packages/contracts/src/cell-assignment.ts");
  for (const token of ["rankAgentsForTask", "selectAssignmentQuartet", "authorizeDelegation", "spawnSubtask", "validateTypedHandoff", "decideProgressAction"]) {
    assert.ok(source.includes(token), token);
  }
});