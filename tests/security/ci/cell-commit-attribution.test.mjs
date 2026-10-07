import assert from "node:assert/strict";
import test from "node:test";
import { validateCommitMessages } from "../../../scripts/ci/cell-commit-attribution.mjs";

const ids = new Set(["EXEC-CELL-ARCH-001", "EXEC-TEST-001"]);

test("accepts commit messages with canonical task attribution", () => {
  assert.deepEqual(validateCommitMessages(["feat(EXEC-CELL-ARCH-001): harden control"], ids), { pass: true, failures: [] });
});

test("rejects missing or unknown task attribution", () => {
  const result = validateCommitMessages(["feat(cell): harden control", "fix(EXEC-UNKNOWN-001): bypass"], ids);
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.startsWith("MISSING_TASK_ID:")));
  assert.ok(result.failures.some((failure) => failure.startsWith("UNKNOWN_TASK_ID:")));
});
