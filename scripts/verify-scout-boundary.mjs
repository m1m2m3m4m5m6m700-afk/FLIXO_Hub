import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const agentsDir = join(root, ".github", "agents");
const ledgerPath = join(root, "التطوير.md");

const scouts = {
  "flixo-scout-architecture.agent.md": "ARCHITECTURE",
  "flixo-scout-technology.agent.md": "TECHNOLOGY",
  "flixo-scout-ecosystem.agent.md": "ECOSYSTEM"
};

const allowedTools = ["read", "search", "edit"];
const forbiddenTools = ["execute", "shell", "bash", "powershell", "terminal", "agent", "web"];
const allowedStatus = ["DISCOVERED", "VERIFIED", "WATCH", "REJECTED"];

function fail(message) {
  console.error("SCOUT_BOUNDARY_FAIL: " + message);
  process.exit(1);
}

function exists(path) {
  try { statSync(path); return true; } catch { return false; }
}

function assertProfiles() {
  if (!exists(agentsDir)) fail("missing .github/agents");

  for (const [file, role] of Object.entries(scouts)) {
    const path = join(agentsDir, file);
    if (!exists(path)) fail("missing profile: " + file);
    const content = readFileSync(path, "utf8");
    if (!content.startsWith("---\n")) fail(file + ": missing frontmatter");

    const toolsLine = content.split("\n").find((line) => line.startsWith("tools:")) ?? "";
    const toolsText = toolsLine.slice(toolsLine.indexOf(":") + 1)
      .replaceAll("[", "").replaceAll("]", "").replaceAll('"', "").replaceAll("'", "");
    const tools = toolsText.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

    if (tools.length !== allowedTools.length || allowedTools.some((tool) => !tools.includes(tool))) {
      fail(file + ": tools must be exactly read, search, edit");
    }
    if (forbiddenTools.some((tool) => tools.includes(tool))) fail(file + ": forbidden tool present");
    if (!content.includes("target: github-copilot")) fail(file + ": wrong target");
    if (!content.includes("disable-model-invocation: true")) fail(file + ": automatic invocation must be disabled");
    if (!content.includes("Your only writable repository file is التطوير.md.")) {
      fail(file + ": missing single-file write contract");
    }
    const requiredSection = role === "ARCHITECTURE" ? "Architecture Radar" : role === "TECHNOLOGY" ? "Technology Radar" : "Ecosystem Radar";
    if (!content.includes("Write only in " + requiredSection)) {
      fail(file + ": missing role-specific write boundary");
    }
  }
}

function sectionName(line) {
  if (line === "## Architecture Radar") return "ARCHITECTURE";
  if (line === "## Technology Radar") return "TECHNOLOGY";
  if (line === "## Ecosystem Radar") return "ECOSYSTEM";
  return null;
}

function isEightDigits(value) {
  return value.length === 8 && [...value].every((c) => c >= "0" && c <= "9");
}

function assertLedger() {
  if (!exists(ledgerPath)) fail("missing التطوير.md");
  const content = readFileSync(ledgerPath, "utf8");
  if (Buffer.byteLength(content, "utf8") > 500000) fail("التطوير.md exceeds 500 KiB");

  for (const required of [
    "## Architecture Radar",
    "## Technology Radar",
    "## Ecosystem Radar",
    "## Executor Handoff Contract"
  ]) {
    if (!content.includes(required)) fail("missing ledger section: " + required);
  }

  const lines = content.split("\n");
  let section = null;
  const ids = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const nextSection = sectionName(line);
    if (nextSection) {
      section = nextSection;
      continue;
    }
    if (!line.startsWith("### SCOUT-")) continue;

    const id = line.slice(4).trim();
    if (id === "SCOUT-ROLE-YYYYMMDD-NNNN") continue;

    const parts = id.split("-");
    if (parts.length !== 4 || parts[0] !== "SCOUT") fail("invalid proposal ID: " + id);
    const role = parts[1];
    const date = parts[2];
    const serial = parts[3];

    if (!(role === "ARCHITECTURE" || role === "TECHNOLOGY" || role === "ECOSYSTEM")) fail("invalid proposal role: " + id);
    if (!isEightDigits(date)) fail("invalid proposal date: " + id);
    if (serial.length !== 4 || ![...serial].every((c) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".includes(c))) fail("invalid proposal serial: " + id);
    if (ids.has(id)) fail("duplicate proposal ID: " + id);
    ids.add(id);

    if (role !== section) fail("proposal " + id + " is outside its assigned radar section");

    const block = [];
    for (let j = index + 1; j < lines.length && !lines[j].startsWith("### SCOUT-") && !lines[j].startsWith("## "); j += 1) {
      block.push(lines[j]);
    }
    const blockText = block.join("\n");

    for (const field of [
      "Scout:", "Category:", "Title:", "Current FLIXO Gap:", "Proposed Improvement:",
      "Expected Benefit:", "Complexity:", "Risk:", "Maturity:", "Evidence:",
      "Sources:", "Source Date / Last Verified:", "Confidence:", "Status:"
    ]) {
      if (!blockText.includes("- " + field)) fail(id + ": missing field " + field);
    }

    const statusLine = block.find((x) => x.trim().startsWith("- Status:"))?.trim() ?? "";
    const status = statusLine.slice("- Status:".length).trim();
    if (!status || status.includes("|")) continue;
    if (!allowedStatus.includes(status)) fail(id + ": invalid Scout status " + status);

    const scoutLine = block.find((x) => x.trim().startsWith("- Scout:"))?.trim() ?? "";
    if (scoutLine !== "- Scout: " + role) fail(id + ": Scout field does not match ID");
  }
}

function assertChangedFiles() {
  const raw = process.env.SCOUT_CHANGED_FILES;
  if (!raw) return;
  const changed = raw.split("\n").map((x) => x.trim()).filter(Boolean);
  const baseBranch = process.env.SCOUT_BASE_BRANCH || "";
  if (baseBranch !== "execution") fail("Scout PR must target execution");
  if (changed.length !== 1 || changed[0] !== "التطوير.md") {
    fail("Scout branch may change only التطوير.md; changed: " + changed.join(", "));
  }
}

assertProfiles();
assertLedger();
assertChangedFiles();
console.log("SCOUT_BOUNDARY=PASS");
