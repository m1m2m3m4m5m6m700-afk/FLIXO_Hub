import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const LEDGER = "المهام.md";
const PROMPTS = "مهام هيرميس.md";

function sectionBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error("Missing section marker: " + startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error("Missing section marker: " + endMarker);
  return source.slice(start + startMarker.length, end);
}

export function parseActiveTasks(source) {
  const active = sectionBetween(source, "# ACTIVE DISPATCH QUEUE", "# END ACTIVE DISPATCH QUEUE");
  const chunks = active.split(/(?=^### EXEC-[A-Z0-9-]+.*$)/gm).filter((chunk) => /^### EXEC-[A-Z0-9-]+/u.test(chunk));
  const tasks = chunks.map((chunk) => {
    const headingId = chunk.match(/^### (EXEC-[A-Z0-9-]+)/u)?.[1] ?? null;
    const field = (name) => {
      const prefix = "- **" + name + ":**";
      const lines = chunk.split(/\r?\n/u).filter((line) => line.startsWith(prefix));
      return lines.length === 1 ? lines[0].slice(prefix.length).trim() : null;
    };
    return {
      id: field("TASK_ID"),
      headingId,
      status: field("STATUS"),
      deps: (field("DEPENDS_ON") ?? "").split(",").map((value) => value.trim()).filter((value) => value && value !== "none"),
      scope: field("SCOPE"),
      collisionKey: field("COLLISION_KEY"),
      whole: chunk,
    };
  });
  return { tasks, active };
}

export function parsePromptIds(source) {
  return [...source.matchAll(/^## Prompt \d+.*?(EXEC-[A-Z0-9-]+)/gmu)].map((match) => match[1]);
}

export function buildDispatchPlan({ ledger, prompts, branch, head, gitStatus }) {
  const tasks = parseActiveTasks(ledger).tasks;
  const failures = [];
  const ids = tasks.map((task) => task.id);
  const headings = tasks.map((task) => task.headingId);
  const promptIds = parsePromptIds(prompts);
  const count = ledger.match(/\*\*ACTIVE TASK COUNT:\*\*\s*(\d+)/u)?.[1];
  const closed = new Set(
    [...sectionBetween(ledger, "## CLOSED TASK REGISTER", "## HERMES EXECUTION CONTRACT").matchAll(/\|\s*(EXEC-[A-Z0-9-]+)\s*\|/gu)]
      .map((match) => match[1]),
  );

  if (!count || Number(count) !== tasks.length) failures.push("QUEUE_COUNT_MISMATCH:declared=" + (count ?? "missing") + ":actual=" + tasks.length);
  if (ids.some((id) => !id) || tasks.some((task) => task.id !== task.headingId)) failures.push("TASK_ID_CARD_HEADING_MISMATCH");
  if (new Set(ids).size !== ids.length) failures.push("DUPLICATE_ACTIVE_TASK_ID");
  if (new Set(headings).size !== headings.length) failures.push("DUPLICATE_TASK_HEADING");
  if (new Set(promptIds).size !== promptIds.length) failures.push("DUPLICATE_HERMES_PROMPT_ID");
  const activeSet = new Set(ids);
  for (const task of tasks) {
    if (!task.status || !task.scope || !task.collisionKey) failures.push("INCOMPLETE_TASK_CARD:" + (task.id ?? task.headingId));
    for (const dep of task.deps) {
      if (!activeSet.has(dep) && !closed.has(dep)) failures.push("UNKNOWN_DEPENDENCY:" + task.id + ":" + dep);
      if (activeSet.has(dep) && dep === task.id) failures.push("SELF_DEPENDENCY:" + task.id);
    }
  }
  const missingPrompts = ids.filter((id) => !promptIds.includes(id));
  const extraPrompts = promptIds.filter((id) => !ids.includes(id));
  if (missingPrompts.length) failures.push("MISSING_HERMES_PROMPTS:" + missingPrompts.join(","));
  if (extraPrompts.length) failures.push("EXTRA_HERMES_PROMPTS:" + extraPrompts.join(","));

  const activeById = new Map(tasks.map((task) => [task.id, task]));
  const candidates = [];
  const deferred = [];
  for (const task of tasks) {
    const reasons = [];
    if (task.status !== "QUEUED") reasons.push("status=" + (task.status ?? "missing"));
    const unsatisfied = task.deps.filter((dep) => activeById.has(dep) || !closed.has(dep));
    if (unsatisfied.length) reasons.push("dependencies-not-closed=" + unsatisfied.join(","));
    if (reasons.length) deferred.push({ id: task.id, reasons });
    else candidates.push(task);
  }
  const scopePaths = (scope) => [...(scope ?? "").matchAll(/`([^`]+)`/gu)]
    .map((match) => match[1].replaceAll("\\", "/").replace(/\/$/u, "").replace(/\/\*\*$/u, ""))
    .filter((value) => value.includes("/") || value.startsWith("."));
  const scopesOverlap = (left, right) => {
    const leftPaths = scopePaths(left.scope);
    const rightPaths = scopePaths(right.scope);
    return leftPaths.some((a) => rightPaths.some((b) =>
      a === b || a.startsWith(b + "/") || b.startsWith(a + "/"),
    ));
  };
  const collisionBlocked = candidates.filter((task) => candidates.some((other) =>
    other.id !== task.id && (other.collisionKey === task.collisionKey || scopesOverlap(task, other)),
  ));
  const collisionBlockedIds = new Set(collisionBlocked.map((task) => task.id));
  const ready = candidates.filter((task) => !collisionBlockedIds.has(task.id));

  return {
    pass: failures.length === 0,
    failures,
    branch,
    head,
    worktreeClean: !gitStatus.trim(),
    dispatchEnabled: failures.length === 0 && branch === "execution" && !gitStatus.trim(),
    counts: { activeTasks: tasks.length, prompts: promptIds.length, ready: ready.length, deferred: deferred.length, collisionBlocked: collisionBlocked.length },
    readyTaskIds: ready.map((task) => task.id),
    deferred,
    collisionBlocked: collisionBlocked.map((task) => task.id),
    safetyNote: "This planner audits readiness only; it does not create worktrees, start agents, change permissions, merge, or certify.",
  };
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/task-dispatch-plan.mjs")) {
  const ledger = readFileSync(LEDGER, "utf8");
  const prompts = readFileSync(PROMPTS, "utf8");
  const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const gitStatus = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" });
  const plan = buildDispatchPlan({ ledger, prompts, branch, head, gitStatus });
  console.log(JSON.stringify(plan, null, 2));
  if (!plan.pass || !plan.dispatchEnabled) process.exitCode = 1;
}
