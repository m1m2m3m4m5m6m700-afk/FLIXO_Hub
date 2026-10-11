import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { parseActiveTasks, parsePromptIds } from "./task-dispatch-plan.mjs";

const ledgerPath = readdirSync(".").find((name) => name.endsWith(".md") && name !== "FLIXO-Tasks.md" && readFileSync(name, "utf8").includes("Canonical Agent Task Ledger"));
const promptsPath = readdirSync(".").find((name) => name.endsWith(".md") && readFileSync(name, "utf8").includes("Hermes Execution Prompt Queue"));
const fields = ["TASK_ID", "TYPE", "PRIORITY", "OWNER", "STATUS", "PR", "SCOPE", "DEPENDS_ON", "SOURCE", "EVIDENCE", "ACCEPTANCE", "NEXT_ACTION", "COLLISION_KEY"];
const writeMode = process.argv.includes("--write");
const fail = (message) => { console.error("HERMES_PROMPT_SYNC=FAIL " + message); process.exit(1); };

if (!ledgerPath || !promptsPath) fail("canonical ledger or prompt view not found");
const newline = (text) => text.includes("\r\n") ? "\r\n" : "\n";
let ledger = readFileSync(ledgerPath, "utf8");
let prompts = readFileSync(promptsPath, "utf8");
const nl = newline(prompts);
const tasks = parseActiveTasks(ledger).tasks;
const declaredCount = ledger.match(/\*\*ACTIVE TASK COUNT:\*\*\s*(\d+)/u)?.[1];
if (!declaredCount) fail("canonical queue is missing ACTIVE TASK COUNT");
if (Number(declaredCount) !== tasks.length) fail("QUEUE_COUNT_MISMATCH declared=" + declaredCount + " actual=" + tasks.length);

const valuesFor = (task) => fields.map((field) => {
  const prefix = "- **" + field + ":**";
  const rows = task.whole.split(/\r?\n/u).filter((line) => line.startsWith(prefix));
  if (rows.length !== 1) throw new Error(task.id + " must have exactly one " + field + " field");
  return rows[0].slice(prefix.length).trim();
});
const cardFor = (task) => "### Canonical task card (source: " + ledgerPath + ")" + nl + nl + fields.map((field, index) => "- **" + field + ":** " + valuesFor(task)[index]).join(nl);
const promptSections = (source) => {
  const queueIntegrity = source.indexOf("## Queue integrity");
  const blockEnd = queueIntegrity >= 0 ? queueIntegrity : source.length;
  const matches = [...source.matchAll(/^## Prompt (\d+)[^\r\n]*$/gmu)].filter((match) => match.index < blockEnd);
  return matches.map((match, index) => {
    const end = index + 1 < matches.length ? matches[index + 1].index : blockEnd;
    const headingId = match[0].match(/(EXEC-[A-Z0-9-]+)/u)?.[1] ?? null;
    return { number: Number(match[1]), id: headingId, start: match.index, end, section: source.slice(match.index, end) };
  });
};

const updateCard = (section, task, promptNumber) => {
  const firstLineBreak = section.indexOf("\n");
  if (firstLineBreak < 0) throw new Error("Prompt section has no body: " + task.id);
  const firstLineEnd = firstLineBreak > 0 && section[firstLineBreak - 1] === "\r" ? firstLineBreak - 1 : firstLineBreak;
  let result = section.slice(0, firstLineEnd).replace(/^## Prompt \d+/u, "## Prompt " + promptNumber) + section.slice(firstLineEnd);
  const marker = /^### Canonical task card \(source:.*\)$/mu.exec(result);
  if (!marker) throw new Error("Prompt card marker missing for " + task.id);
  const cardStart = marker.index;
  const suffixMatch = /\r?\n---(?:\r?\n|$)/u.exec(result.slice(cardStart + marker[0].length));
  if (!suffixMatch) throw new Error("Prompt card separator missing for " + task.id);
  const separatorStart = cardStart + marker[0].length + suffixMatch.index + (suffixMatch[0].startsWith("\r\n") ? 2 : 1);
  return result.slice(0, cardStart) + cardFor(task) + nl + nl + result.slice(separatorStart);
};

const ids = tasks.map((task) => task.id);
if (new Set(ids).size !== ids.length || tasks.some((task) => !task.id || task.id !== task.headingId)) fail("canonical task IDs are invalid or duplicated");
let sections = promptSections(prompts);
let sectionIds = sections.map((section) => section.id);
if (new Set(sectionIds).size !== sectionIds.length) fail("DUPLICATE_HERMES_PROMPT_ID");
const extra = sectionIds.filter((id) => !ids.includes(id));
if (extra.length) fail("EXTRA_HERMES_PROMPTS " + extra.join(","));

if (writeMode) {
  for (let i = sections.length - 1; i >= 0; i--) {
    const section = sections[i];
    const task = tasks.find((item) => item.id === section.id);
    if (!task) continue;
    const updated = updateCard(section.section, task, i + 1);
    prompts = prompts.slice(0, section.start) + updated + prompts.slice(section.end);
  }
  sections = promptSections(prompts);
  sectionIds = sections.map((section) => section.id);
  const nowMissing = tasks.filter((task) => !sectionIds.includes(task.id));
  if (nowMissing.length) {
    const queueIntegrity = prompts.indexOf("## Queue integrity");
    if (queueIntegrity < 0) fail("Queue integrity summary is missing");
    const first = sections[0];
    if (!first) fail("No existing prompt template is available");
    const cardMarker = /^### Canonical task card \(source:.*\)$/mu.exec(first.section);
    if (!cardMarker) fail("Cannot extract common prompt contract");
    const firstLineBreak = first.section.indexOf("\n");
    const lineEndingLength = firstLineBreak > 0 && first.section[firstLineBreak - 1] === "\r" ? 2 : 1;
    const commonBody = first.section.slice(firstLineBreak + lineEndingLength, cardMarker.index).trim();
    const maxNumber = sections.reduce((max, section) => Math.max(max, section.number), 0);
    const generated = nowMissing.map((task, index) => "## Prompt " + (maxNumber + index + 1) + " - " + task.id + nl + nl + commonBody + nl + nl + cardFor(task) + nl + nl + "---");
    const before = prompts.slice(0, queueIntegrity).replace(/[\r\n]+$/u, "");
    const after = prompts.slice(queueIntegrity).replace(/Generated task prompts:\s*\d+/u, "Generated task prompts: " + tasks.length);
    prompts = before + nl + nl + generated.join(nl + nl) + nl + nl + after;
  } else {
    const queueIntegrity = prompts.indexOf("## Queue integrity");
    const before = prompts.slice(0, queueIntegrity);
    const after = prompts.slice(queueIntegrity).replace(/Generated task prompts:\s*\d+/u, "Generated task prompts: " + tasks.length);
    prompts = before + after;
  }
  writeFileSync(promptsPath, prompts, "utf8");
  prompts = readFileSync(promptsPath, "utf8");
}

sections = promptSections(prompts);
sectionIds = sections.map((section) => section.id);
const errors = [];
const parsedIds = parsePromptIds(prompts);
if (sections.length !== tasks.length) errors.push("PROMPT_COUNT_MISMATCH prompts=" + sections.length + " tasks=" + tasks.length);
if (parsedIds.length !== tasks.length) errors.push("PROMPT_ID_COUNT_MISMATCH prompts=" + parsedIds.length + " tasks=" + tasks.length);
if (new Set(sectionIds).size !== sectionIds.length) errors.push("DUPLICATE_HERMES_PROMPT_ID");
for (const task of tasks) {
  const matches = sections.filter((section) => section.id === task.id);
  if (matches.length !== 1) { errors.push("PROMPT_CARD_PARITY:" + task.id + ":count=" + matches.length); continue; }
  const section = matches[0].section;
  const marker = /^### Canonical task card \(source:.*\)$/mu.exec(section);
  if (!marker) { errors.push("PROMPT_CARD_MISSING:" + task.id); continue; }
  const suffixMatch = /\r?\n---(?:\r?\n|$)/u.exec(section.slice(marker.index + marker[0].length));
  if (!suffixMatch) { errors.push("PROMPT_CARD_SEPARATOR_MISSING:" + task.id); continue; }
  const prefixLength = suffixMatch[0].startsWith("\r\n") ? 2 : 1;
  const cardEnd = marker.index + marker[0].length + suffixMatch.index + prefixLength;
  const actual = section.slice(marker.index, cardEnd).replace(/\r\n/gu, "\n").trimEnd();
  const expected = cardFor(task).replace(/\r\n/gu, "\n").trimEnd();
  if (actual !== expected) errors.push("PROMPT_CARD_DRIFT:" + task.id);
}
if (sectionIds.some((id) => !ids.includes(id))) errors.push("EXTRA_HERMES_PROMPTS");
const summary = prompts.match(/Generated task prompts:\s*(\d+)/u)?.[1];
if (!summary || Number(summary) !== tasks.length) errors.push("PROMPT_SUMMARY_COUNT_MISMATCH");
if (errors.length) fail(errors.join("; "));
console.log("HERMES_PROMPT_SYNC=PASS TASKS=" + tasks.length);
