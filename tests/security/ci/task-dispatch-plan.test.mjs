import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { buildDispatchPlan, parseActiveTasks, parsePromptIds } from "../../../scripts/task-dispatch-plan.mjs";

const ledgerPath = "المهام.md";
const promptsPath = "مهام هيرميس.md";

function card(id, { status = "QUEUED", dep = "none", key = id, scope = "src/example" } = {}) {
  return [
    "### " + id + " — test",
    "- **TASK_ID:** " + id,
    "- **TYPE:** IMPLEMENT",
    "- **PRIORITY:** P1",
    "- **OWNER:** QA",
    "- **STATUS:** " + status,
    "- **PR:** none",
    "- **SCOPE:** " + scope,
    "- **DEPENDS_ON:** " + dep,
    "- **SOURCE:** test",
    "- **EVIDENCE:** none",
    "- **ACCEPTANCE:** test passes",
    "- **NEXT_ACTION:** run test",
    "- **COLLISION_KEY:** " + key,
    "",
  ].join("\n");
}

function fixtureLedger(cards, count = cards.length, closed = "") {
  return [
    "## CLOSED TASK REGISTER",
    "| TASK_ID | CLOSE_REF | COMMIT_SHA | CLOSED_UTC |",
    closed,
    "## HERMES EXECUTION CONTRACT",
    "# ACTIVE DISPATCH QUEUE",
    "**ACTIVE TASK COUNT:** " + count,
    cards.join("\n"),
    "# END ACTIVE DISPATCH QUEUE",
  ].join("\n");
}

test("real canonical ledger and Hermes prompt IDs match exactly", () => {
  const ledger = readFileSync(ledgerPath, "utf8");
  const prompts = readFileSync(promptsPath, "utf8");
  const parsed = parseActiveTasks(ledger);
  const ids = parsed.tasks.map((task) => task.id);
  const promptIds = parsePromptIds(prompts);
  assert.equal(ids.length, 36);
  assert.equal(promptIds.length, ids.length);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...promptIds].sort(), [...ids].sort());
  const plan = buildDispatchPlan({
    ledger,
    prompts,
    branch: "execution",
    head: "fixture-sha",
    gitStatus: " M user-work.ts",
  });
  assert.equal(plan.pass, true, plan.failures.join("\n"));
  assert.equal(plan.dispatchEnabled, false, "dirty user work must fail closed");
});

test("dispatch plan only marks dependency-free queued tasks ready on a clean execution branch", () => {
  const cards = [
    card("EXEC-A-001"),
    card("EXEC-B-001", { dep: "EXEC-A-001" }),
    card("EXEC-C-001", { key: "other" }),
  ];
  const ledger = fixtureLedger(cards);
  const prompts = [
    "## Prompt 1 — EXEC-A-001",
    "## Prompt 2 — EXEC-B-001",
    "## Prompt 3 — EXEC-C-001",
  ].join("\n");
  const plan = buildDispatchPlan({ ledger, prompts, branch: "execution", head: "sha", gitStatus: "" });
  assert.equal(plan.pass, true, plan.failures.join("\n"));
  assert.equal(plan.dispatchEnabled, true);
  assert.deepEqual(plan.readyTaskIds, ["EXEC-A-001", "EXEC-C-001"]);
  assert.ok(plan.deferred.some((task) => task.id === "EXEC-B-001" && task.reasons.some((reason) => reason.includes("EXEC-A-001"))));
});

test("duplicate prompts, unknown dependencies, and count drift fail closed", () => {
  const ledger = fixtureLedger([
    card("EXEC-A-001"),
    card("EXEC-B-001", { dep: "EXEC-MISSING-001" }),
  ], 3);
  const prompts = "## Prompt 1 — EXEC-A-001\n## Prompt 2 — EXEC-A-001";
  const plan = buildDispatchPlan({ ledger, prompts, branch: "execution", head: "sha", gitStatus: "" });
  assert.equal(plan.pass, false);
  assert.ok(plan.failures.some((failure) => failure.startsWith("QUEUE_COUNT_MISMATCH")));
  assert.ok(plan.failures.includes("DUPLICATE_HERMES_PROMPT_ID"));
  assert.ok(plan.failures.some((failure) => failure.startsWith("UNKNOWN_DEPENDENCY")));
});

test("duplicate collision keys are not scheduled concurrently", () => {
  const ledger = fixtureLedger([
    card("EXEC-A-001", { key: "shared" }),
    card("EXEC-B-001", { key: "shared" }),
  ]);
  const prompts = "## Prompt 1 — EXEC-A-001\n## Prompt 2 — EXEC-B-001";
  const plan = buildDispatchPlan({ ledger, prompts, branch: "execution", head: "sha", gitStatus: "" });
  assert.equal(plan.pass, true);
  assert.deepEqual(plan.readyTaskIds, []);
  assert.equal(plan.counts.collisionBlocked, 2);
});

test("overlapping path scopes block concurrent dispatch even with different collision keys", () => {
  const ledger = fixtureLedger([
    card("EXEC-A-001", { key: "lane-a", scope: "`src/lib/**`" }),
    card("EXEC-B-001", { key: "lane-b", scope: "`src/lib/cell/runtime.ts`" }),
  ]);
  const prompts = "## Prompt 1 — EXEC-A-001\n## Prompt 2 — EXEC-B-001";
  const plan = buildDispatchPlan({ ledger, prompts, branch: "execution", head: "sha", gitStatus: "" });
  assert.deepEqual(plan.readyTaskIds, []);
  assert.equal(plan.counts.collisionBlocked, 2);
});

test("Hermes prompt task-card fields are synchronized to the canonical ledger", () => {
  const result = execFileSync(process.execPath, ["scripts/sync-hermes-task-prompts.mjs"], { encoding: "utf8" });
  assert.match(result, /HERMES_PROMPT_SYNC=PASS/u);
  assert.match(result, /TASKS=36/u);
});
