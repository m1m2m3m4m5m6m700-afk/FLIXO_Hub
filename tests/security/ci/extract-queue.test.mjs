import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const ledgerPath = "المهام.md";
const ledger = readFileSync(resolve(repositoryRoot, ledgerPath), "utf8");
const declaredCount = Number(ledger.match(/\*\*ACTIVE TASK COUNT:\*\*\s*(\d+)/u)?.[1]);
const output = execFileSync(process.execPath, ["scripts/extract-queue.mjs"], {
  cwd: repositoryRoot,
  encoding: "utf8",
});
const rows = output.trim().split(/\r?\n/u);
const records = rows.map((row) => {
  const fields = row.split("|");
  assert.equal(fields.length, 4, "each row must contain ID, type, status, and title");
  return { id: fields[0], type: fields[1], status: fields[2], title: fields[3] };
});

test("extract-queue reads the standalone canonical queue boundaries and extracts complete records", () => {
  assert.ok(records.length > 0);
  assert.equal(records.length, declaredCount);
  const first = records.find((record) => record.id === "EXEC-PR-RECONCILE-001");
  assert.ok(first, "expected the canonical P0 reconciliation task");
  assert.equal(first.type, "INTEGRATE");
  assert.match(first.status, /^[A-Z][A-Z0-9 _-]*$/u);
  assert.ok(first.title.length > 0);
  assert.doesNotMatch(first.title, /^EXEC-/u, "title must not retain its task ID");
});

test("extract-queue excludes non-dispatchable CELL parent references", () => {
  assert.equal(records.some((record) => record.id === "EXEC-CELL-LIVENESS-001"), false);
});

test("extract-queue emits unique canonical task IDs with no unknown metadata", () => {
  const ids = records.map((record) => record.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(records.every((record) => record.id.startsWith("EXEC-")));
  assert.ok(records.every((record) => record.type !== "?" && record.status !== "?"));
});
