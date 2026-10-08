import assert from "node:assert/strict";
import test from "node:test";
import {
  isCellAttributionPath,
  taskIdsFromLedger,
  validateCommitMessages,
  validateCommitRecords,
} from "../../../scripts/ci/cell-commit-attribution.mjs";

const ids = new Set(["EXEC-CELL-CTRL-002", "EXEC-TEST-001"]);

test("accepts task IDs that are no longer active but remain canonical historical ledger entries", () => {
  const ids = taskIdsFromLedger(`
# ACTIVE DISPATCH QUEUE
EXEC-ACTIVE-001
# END ACTIVE DISPATCH QUEUE
# CLOSED TASK REGISTER
EXEC-CLOSED-001
`);
  assert.equal(ids.has("EXEC-CLOSED-001"), true);
  assert.deepEqual(
    validateCommitMessages(["fix(EXEC-CLOSED-001): historical repair"], ids),
    { pass: true, failures: [] },
  );
});

test("accepts commit messages with canonical task attribution", () => {
  assert.deepEqual(
    validateCommitMessages(["feat(EXEC-CELL-CTRL-002): harden control"], ids),
    { pass: true, failures: [] },
  );
});

test("rejects missing or unknown task attribution for scoped commits", () => {
  const result = validateCommitRecords(
    [
      { sha: "a".repeat(40), message: "feat(cell): harden control", files: ["packages/contracts/src/cell-hard-control.ts"] },
      { sha: "b".repeat(40), message: "fix(EXEC-UNKNOWN-001): bypass", files: ["tests/security/ci/cell-hard-control.test.ts"] },
    ],
    ids,
  );
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.includes("MISSING_TASK_ID:")));
  assert.ok(result.failures.some((failure) => failure.includes("UNKNOWN_TASK_ID:")));
});

test("does not require attribution for unrelated commits", () => {
  const result = validateCommitRecords(
    [{ sha: "c".repeat(40), message: "fix(agent-learning): simplify parser", files: ["scripts/agent-learning/parser.mjs"] }],
    ids,
  );
  assert.deepEqual(result, { pass: true, failures: [] });
});

test("classifies only canonical CELL surfaces", () => {
  assert.equal(isCellAttributionPath("packages/contracts/src/cell-hard-control.ts"), true);
  assert.equal(isCellAttributionPath("tests/security/ci/cell-hard-control.test.ts"), true);
  assert.equal(isCellAttributionPath("docs/CELL-HARD-CONTROL-CONTRACT.md"), true);
  assert.equal(isCellAttributionPath(".github/workflows/agent-watchdog.yml"), false);
  assert.equal(isCellAttributionPath("scripts/agent-learning/parser.mjs"), false);
});
