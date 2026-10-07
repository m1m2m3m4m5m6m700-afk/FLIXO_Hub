#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { validateExperienceLifecycle, EXPERIENCE_LIFECYCLE } from "./agent-learning/experience-runtime.mjs";
import { resolve, join, relative } from "node:path";

const ROOT = process.cwd();
const REGISTRY = join(ROOT, "الوكلاء.md");
const PROTOCOL = "flixo-agent-activity-v1";
const REQUIRED_FIELDS = [
  "Agent ID",
  "Agent Name",
  "Task ID",
  "Exact SHA Before",
  "Intent / Decision Summary",
  "Scope",
  "Action / Command",
  "Files / Artifacts",
  "Outcome",
  "Evidence / Reference",
  "Exact SHA After",
  "RCA / Blocker",
  "Next Action",
];

function loadRegistry() {
  const source = readFileSync(REGISTRY, "utf8");
  const start = source.indexOf("<!-- CANONICAL_AGENT_REGISTRY:START -->");
  const end = source.indexOf("<!-- CANONICAL_AGENT_REGISTRY:END -->");
  if (start < 0 || end <= start) throw new Error("canonical registry markers missing");
  const block = source.slice(start, end);
  const jsStart = block.indexOf("```json");
  const jsEnd = block.indexOf("```", jsStart + 7);
  if (jsStart < 0 || jsEnd <= jsStart) throw new Error("canonical registry JSON missing");
  return JSON.parse(block.slice(jsStart + 7, jsEnd).trim());
}

function agents() {
  const registry = loadRegistry();
  return [...(registry.agents ?? []), ...(registry.supportingRoles ?? [])];
}

function assertSafeRelative(path) {
  if (!path || path.includes("..") || path.startsWith("/") || path.startsWith("\\")) {
    throw new Error("unsafe activityLog path: " + path);
  }
}

export function auditActivityLogs(root = ROOT) {
  const failures = [];
  for (const agent of agents()) {
    const path = agent.activityLog;
    if (typeof path !== "string") {
      failures.push(agent.id + ": missing activityLog in canonical registry");
      continue;
    }
    try { assertSafeRelative(path); } catch (error) { failures.push(agent.id + ": " + error.message); continue; }
    const absolute = resolve(root, path);
    const rel = relative(root, absolute);
    if (rel.startsWith("..") || rel.startsWith("\\")) {
      failures.push(agent.id + ": activityLog escapes repository");
      continue;
    }
    if (!existsSync(absolute) || !statSync(absolute).isFile()) {
      failures.push(agent.id + ": activityLog missing: " + path);
      continue;
    }
    const text = readFileSync(absolute, "utf8");
    if (!text.includes("Protocol: `" + PROTOCOL + "`")) failures.push(agent.id + ": wrong/missing protocol marker");
    if (!text.includes("Agent ID: " + agent.id)) failures.push(agent.id + ": agent identity missing from log");
    if (!text.includes("Mode:** Append-Only / FAIL-CLOSED")) failures.push(agent.id + ": append-only/fail-closed marker missing");
    if (!text.includes("## قاعدة إلزامية")) failures.push(agent.id + ": mandatory logging rule missing");
    if (!/^### EVENT /mu.test(text)) failures.push(agent.id + ": no event records");
    const scopeDir = agent.report ?? "";
    if (scopeDir.endsWith("/") && !path.startsWith(scopeDir)) {
      failures.push(agent.id + ": activityLog must stay inside report/write scope");
    }
    const events = [...text.matchAll(/^### EVENT .*$/gmu)].map(m => m[0]);
    if (events.length === 0) failures.push(agent.id + ": event parsing failed");
    const firstEvent = text.indexOf("### EVENT");
    const initEvent = text.slice(firstEvent, text.indexOf("\n### EVENT", firstEvent + 1) > 0 ? text.indexOf("
### EVENT", firstEvent + 1) : text.length);
    if (!initEvent.includes("- Agent ID: " + agent.id)) failures.push(agent.id + ": first event identity mismatch");
    for (const field of ["Agent ID", "Agent Name", "Task ID", "Exact SHA Before", "Outcome", "Next Action"]) {
      if (!initEvent.includes("- " + field + ":")) failures.push(agent.id + ": first event missing " + field);
    }
  }
  return { protocol: PROTOCOL, agentCount: agents().length, failures, status: failures.length === 0 ? "PASS" : "BLOCKED" };
}

function parseArgs(argv) {
  const args = {};
  for (const token of argv) {
    const match = token.match(/^--([^=]+)=(.*)$/u);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

function findAgent(id) {
  return agents().find(agent => agent.id === id);
}

function assertSha(value, label) {
  if (!/^[0-9a-f]{40}$/u.test(String(value ?? ""))) throw new Error(label + " must be an exact 40-char SHA");
}

export const EXPERIENCE_EVENT_TYPES = EXPERIENCE_LIFECYCLE;

export function validateExperienceEventSequence(events) {
  return validateExperienceLifecycle(events);
}

export function appendActivityEvent({ agentId, eventType, taskId = "UNBOUND", shaBefore, summary, scope = "task-scope", action = "not-specified", files = "none", outcome = "RECORDED", evidence = "none", shaAfter = "UNCHANGED", blocker = "none", next = "none", timestamp = new Date().toISOString(), root = ROOT }) {
  const agent = findAgent(agentId);
  if (!agent) throw new Error("unknown agent: " + agentId);
  assertSha(shaBefore, "shaBefore");
  if (shaAfter !== "UNCHANGED") assertSha(shaAfter, "shaAfter");
  const logPath = resolve(root, agent.activityLog);
  if (!existsSync(logPath)) throw new Error("activityLog missing; fail-closed: " + agent.activityLog);
  const lines = [
    "",
    `### EVENT ${timestamp} — ${eventType}`,
    `- Agent ID: ${agent.id}`,
    `- Agent Name: ${agent.name}`,
    `- Task ID: ${taskId}`,
    `- Exact SHA Before: ${shaBefore}`,
    `- Intent / Decision Summary: ${summary}`,
    `- Scope: ${scope}`,
    `- Action / Command: ${action}`,
    `- Files / Artifacts: ${files}`,
    `- Outcome: ${outcome}`,
    `- Evidence / Reference: ${evidence}`,
    `- Exact SHA After: ${shaAfter}`,
    `- RCA / Blocker: ${blocker}`,
    `- Next Action: ${next}`,
    "",
  ];
  appendFileSync(logPath, lines.join("\n"), { encoding: "utf8" });
  return logPath;
}

if (process.argv[1]?.endsWith("agent-activity-ledger.mjs")) {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "audit") {
    const result = auditActivityLogs();
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "PASS") process.exitCode = 1;
  } else if (command === "append") {
    try {
      const args = parseArgs(rest);
      const result = appendActivityEvent({
        agentId: args.agent,
        eventType: args.event,
        taskId: args.task ?? "UNBOUND",
        shaBefore: args.shaBefore,
        summary: args.summary,
        scope: args.scope,
        action: args.action,
        files: args.files,
        outcome: args.outcome,
        evidence: args.evidence,
        shaAfter: args.shaAfter ?? "UNCHANGED",
        blocker: args.blocker,
        next: args.next,
      });
      console.log(result);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  } else {
    console.error("Usage: node scripts/agent-activity-ledger.mjs audit | append --agent=AGENT-XX --event=TYPE --shaBefore=<40hex> --summary=<text> ...");
    process.exitCode = 1;
  }
}
