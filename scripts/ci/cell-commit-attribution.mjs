#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export function taskIdsFromLedger(source) {
  return new Set([...source.matchAll(/\b(EXEC-[A-Z0-9-]+)\b/gu)].map((match) => match[1]));
}

export function validateCommitMessages(messages, allowedTaskIds) {
  const failures = [];
  for (const message of messages) {
    const ids = [...message.matchAll(/\b(EXEC-[A-Z0-9-]+)\b/gu)].map((match) => match[1]);
    if (ids.length === 0) failures.push("MISSING_TASK_ID:" + message.split("\n")[0]);
    else if (!ids.some((id) => allowedTaskIds.has(id))) failures.push("UNKNOWN_TASK_ID:" + ids.join(","));
  }
  return { pass: failures.length === 0, failures };
}

export function commitMessagesBetween(baseSha, headSha) {
  if (!baseSha || !headSha || baseSha === headSha) return [];
  const output = execFileSync("git", ["log", "--format=%B%x00", "--no-merges", baseSha + ".." + headSha], { encoding: "utf8" });
  return output.split("\0").map((value) => value.trim()).filter(Boolean);
}

function main() {
  const ledger = readFileSync("المهام.md", "utf8");
  const baselineDoc = readFileSync("docs/CELL-HARD-CONTROL-ATTRIBUTION-BASELINE.md", "utf8");
  const baseline = baselineDoc.match(/BASELINE_SHA:\s*([0-9a-f]{40})/u)?.[1];
  const head = process.env.GITHUB_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const base = process.env.CELL_ATTRIBUTION_BASE_SHA ?? baseline;
  if (!base) throw new Error("ATTRIBUTION_BASELINE_MISSING");
  const result = validateCommitMessages(commitMessagesBetween(base, head), taskIdsFromLedger(ledger));
  if (!result.pass) {
    console.error("CELL_COMMIT_ATTRIBUTION=FAIL");
    for (const failure of result.failures) console.error(failure);
    process.exit(1);
  }
  console.log("CELL_COMMIT_ATTRIBUTION=PASS");
  console.log("BASELINE_SHA=" + base);
  console.log("HEAD_SHA=" + head);
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll("\\", "/"))) main();
