#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const CELL_ATTRIBUTION_PATH_PATTERNS = Object.freeze([
  /^packages\/contracts\/src\/cell[^/]*\.(?:ts|tsx)$/u,
  /^tests\/security\/ci\/cell[^/]*\.(?:ts|tsx|mjs|js)$/u,
  /^tests\/cell[^/]*\.(?:ts|tsx|mjs|js)$/u,
  /^scripts\/ci\/cell[^/]*\.(?:mjs|js|sh)$/u,
  /^docs\/CELL[^/]*\.(?:md|mdx)$/u,
  /^AGENTS\.md$/u,
  /^الخلية\.md$/u,
  /^المهام\.md$/u,
]);

export function taskIdsFromLedger(source) {
  return new Set([...source.matchAll(/\b(EXEC-[A-Z0-9-]+)\b/gu)].map((match) => match[1]));
}

export function isCellAttributionPath(path) {
  return CELL_ATTRIBUTION_PATH_PATTERNS.some((pattern) => pattern.test(path));
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

export function validateCommitRecords(records, allowedTaskIds) {
  const failures = [];
  for (const record of records) {
    if (!record.files.some(isCellAttributionPath)) continue;
    const result = validateCommitMessages([record.message], allowedTaskIds);
    failures.push(...result.failures.map((failure) => record.sha + ":" + failure));
  }
  return { pass: failures.length === 0, failures };
}

export function commitRecordsBetween(baseSha, headSha) {
  if (!baseSha || !headSha || baseSha === headSha) return [];
  const output = execFileSync(
    "git",
    ["log", "--format=%x1e%H%x00%B%x00", "--name-only", "--no-merges", baseSha + ".." + headSha],
    { encoding: "utf8" },
  );
  const chunks = output.split("\x1e").filter(Boolean);
  return chunks.map((chunk) => {
    const firstNull = chunk.indexOf("\x00");
    if (firstNull < 0) throw new Error("ATTRIBUTION_LOG_PARSE_FAILED");
    const sha = chunk.slice(0, firstNull);
    const afterSha = chunk.slice(firstNull + 1);
    const secondNull = afterSha.indexOf("\x00");
    if (secondNull < 0) throw new Error("ATTRIBUTION_LOG_PARSE_FAILED");
    const message = afterSha.slice(0, secondNull).trim();
    const files = afterSha.slice(secondNull + 1).split(/\r?\n/u).map((value) => value.trim()).filter(Boolean);
    return { sha, message, files };
  });
}

function main() {
  const ledger = readFileSync("المهام.md", "utf8");
  const baselineDoc = readFileSync("docs/CELL-HARD-CONTROL-ATTRIBUTION-BASELINE.md", "utf8");
  const baseline = baselineDoc.match(/BASELINE_SHA:\s*([0-9a-f]{40})/u)?.[1];
  const head = process.env.CELL_ATTRIBUTION_HEAD_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const base = process.env.CELL_ATTRIBUTION_BASE_SHA ?? baseline;
  if (!base) throw new Error("ATTRIBUTION_BASELINE_MISSING");
  const result = validateCommitRecords(commitRecordsBetween(base, head), taskIdsFromLedger(ledger));
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
