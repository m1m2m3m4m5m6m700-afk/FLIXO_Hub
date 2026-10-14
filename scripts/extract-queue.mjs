import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ledgerPath = resolve(repositoryRoot, "المهام.md");
const lines = readFileSync(ledgerPath, "utf8").split(/\r?\n/u);

const activeStart = lines.findIndex((line) => line.trim() === "# ACTIVE DISPATCH QUEUE");
const activeEnd = lines.findIndex((line) => line.trim() === "# END ACTIVE DISPATCH QUEUE");

if (activeStart < 0 || activeEnd <= activeStart) {
  throw new Error("Canonical active task queue boundaries are missing in المهام.md");
}

const records = [];
for (let i = activeStart + 1; i < activeEnd; i += 1) {
  const line = lines[i];
  if (/^## .*NON-DISPATCHABLE/iu.test(line)) {
    throw new Error("Non-dispatchable section is inside the active task queue");
  }
  if (!line.startsWith("### EXEC-")) continue;

  const heading = line.match(/^### (EXEC-[A-Z0-9-]+) — (.+?)\s*$/u);
  if (!heading) {
    throw new Error("Invalid active task heading at line " + (i + 1) + ": " + line);
  }

  let cardEnd = i + 1;
  while (cardEnd < activeEnd && !/^#{2,3} /u.test(lines[cardEnd])) {
    cardEnd += 1;
  }
  const card = lines.slice(i + 1, cardEnd).join("\n");
  const type = card.match(/^- \*\*TYPE:\*\* (.+?)\s*$/mu)?.[1] ?? "?";
  const status = card.match(/^- \*\*STATUS:\*\* (.+?)\s*$/mu)?.[1] ?? "?";

  records.push({
    id: heading[1],
    type: type.trim(),
    status: status.trim(),
    title: heading[2].trim(),
  });
  i = cardEnd - 1;
}

const ids = records.map(({ id }) => id);
const declaredCount = readFileSync(ledgerPath, "utf8").match(/\*\*ACTIVE TASK COUNT:\*\*\s*(\d+)/u)?.[1];
if (records.length === 0) throw new Error("No canonical active task cards were extracted");
if (!declaredCount || Number(declaredCount) !== records.length) {
  throw new Error("Active queue count mismatch: declared=" + (declaredCount ?? "missing") + " extracted=" + records.length);
}
if (new Set(ids).size !== ids.length) throw new Error("Duplicate task IDs in canonical active queue");

process.stdout.write(records.map(({ id, type, status, title }) =>
  [id, type, status, title].join("|")
).join("\n") + "\n");
