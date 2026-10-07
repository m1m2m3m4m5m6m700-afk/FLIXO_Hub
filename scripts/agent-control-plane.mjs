#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export const AGENT_CAPABILITIES = [
  'READ_REPOSITORY',
  'SEARCH',
  'TERMINAL',
  'EDIT_SOURCE',
  'EDIT_TESTS',
  'EDIT_WORKFLOWS',
  'EDIT_GOVERNANCE',
  'EDIT_TASKS',
  'EDIT_AGENT_PROFILES',
  'WRITE_REPORTS',
  'WRITE_INBOX',
  'MERGE',
  'DEPLOY',
  'CERTIFY',
  'DELEGATE',
];

export const CAPABILITY_MODES = ['ALLOW', 'DENY', 'SCOPED'];
export const LIFECYCLE_STATES = [
  'DEFINED',
  'READY-CONTRACT',
  'READY-TEST',
  'BEHAVIORAL-OBSERVED',
  'BLOCKED',
  'RETIRED',
];

const REGISTRY_START = '<!-- CANONICAL_AGENT_REGISTRY:START -->';
const REGISTRY_END = '<!-- CANONICAL_AGENT_REGISTRY:END -->';
const PROFILE_DIR = '.github/agents';
const LEDGER = 'المهام.md';
const ROLE_DRILLS = 'scripts/agent-learning/run-role-drills.mjs';

function gitHead(root) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value.startsWith('[') && value.endsWith(']')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* invalid JSON array syntax: continue as scalar */ }
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

export function parseProfileFrontmatter(content) {
  if (!content.startsWith('---\n')) throw new Error('profile frontmatter is missing');
  const end = content.indexOf('\n---', 4);
  if (end < 0) throw new Error('profile frontmatter is unterminated');
  const fields = {};
  for (const line of content.slice(4, end).split('\n')) {
    if (!line.trim()) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/u);
    if (!match) continue;
    fields[match[1]] = parseScalar(match[2]);
  }
  return fields;
}

export function loadCanonicalRegistry(root = process.cwd()) {
  const path = join(root, 'الوكلاء.md');
  const content = readFileSync(path, 'utf8');
  const start = content.indexOf(REGISTRY_START);
  const end = content.indexOf(REGISTRY_END);
  if (start < 0 || end <= start) throw new Error('canonical agent registry markers missing');
  const block = content.slice(start + REGISTRY_START.length, end);
  const jsonStart = block.indexOf('```json');
  const jsonEnd = block.indexOf('```', jsonStart + 7);
  if (jsonStart < 0 || jsonEnd <= jsonStart) throw new Error('canonical agent registry JSON missing');
  return JSON.parse(block.slice(jsonStart + 7, jsonEnd).trim());
}

function isSafePath(value) {
  return typeof value === 'string' && value.length > 0 && !value.includes('..') && !value.startsWith('/') && !value.startsWith('\\');
}

function pathExists(root, value) {
  if (!value || value.includes('#')) return true;
  return existsSync(join(root, value));
}

function localProfileNames(root) {
  return readdirSync(join(root, PROFILE_DIR)).filter(name => name.endsWith('.md')).sort();
}

function validateCapabilityContract(profile, id, issues, expected) {
  for (const capability of AGENT_CAPABILITIES) {
    const key = 'cap_' + capability;
    if (!(key in profile)) {
      issues.push(id + ': missing ' + key);
      continue;
    }
    if (!CAPABILITY_MODES.includes(profile[key])) {
      issues.push(id + ': invalid ' + key + ' mode');
    }
  }

  if (profile.certification_authority !== false) issues.push(id + ': certification_authority must be false');
  if (profile.merge_authority !== false) issues.push(id + ': merge_authority must be false');
  if (profile.deploy_authority !== false) issues.push(id + ': deploy_authority must be false');
  if (profile.self_certification !== false) issues.push(id + ': self_certification must be false');
  if (profile.cap_DELEGATE !== 'DENY') issues.push(id + ': DELEGATE must be DENY');
  if (profile.cap_MERGE !== 'DENY') issues.push(id + ': MERGE must be DENY');
  if (profile.cap_DEPLOY !== 'DENY') issues.push(id + ': DEPLOY must be DENY');
  if (profile.cap_CERTIFY !== 'DENY') issues.push(id + ': CERTIFY must be DENY');

  const tools = Array.isArray(profile.tools)
    ? profile.tools
    : String(profile.tools ?? '').split(',').map(v => v.trim()).filter(Boolean);

  if (tools.includes('read') && !['ALLOW', 'SCOPED'].includes(profile.cap_READ_REPOSITORY)) {
    issues.push(id + ': read tool requires READ_REPOSITORY capability');
  }
  if (tools.includes('search') && !['ALLOW', 'SCOPED'].includes(profile.cap_SEARCH)) {
    issues.push(id + ': search tool requires SEARCH capability');
  }
  if (tools.includes('terminal') && !['ALLOW', 'SCOPED'].includes(profile.cap_TERMINAL)) {
    issues.push(id + ': terminal tool requires TERMINAL capability');
  }
  if (!tools.includes('terminal') && profile.cap_TERMINAL !== 'DENY') {
    issues.push(id + ': TERMINAL must be DENY when terminal tool is absent');
  }

  const scouts = id === 'AGENT-08' || id === 'AGENT-09' || id === 'AGENT-10';
  if (scouts) {
    if (JSON.stringify(tools) !== JSON.stringify(['read', 'search', 'edit'])) {
      issues.push(id + ': Scout tools must be exactly read/search/edit');
    }
    if (profile.cap_WRITE_REPORTS !== 'SCOPED' || profile.cap_WRITE_INBOX !== 'DENY') {
      issues.push(id + ': Scout output boundary must be canonical reports-only');
    }
    if (profile.write_scope !== expected.report || profile.report_scope !== expected.report) {
      issues.push(id + ': Scout report boundary must match canonical report directory');
    }
    for (const capability of ['EDIT_SOURCE', 'EDIT_TESTS', 'EDIT_WORKFLOWS', 'EDIT_GOVERNANCE', 'EDIT_TASKS', 'EDIT_AGENT_PROFILES']) {
      if (profile['cap_' + capability] !== 'DENY') issues.push(id + ': Scout ' + capability + ' must be DENY');
    }
  } else {
    if (profile.cap_WRITE_INBOX !== 'DENY') issues.push(id + ': non-Scout WRITE_INBOX must be DENY');
    if (profile.cap_WRITE_REPORTS !== 'SCOPED') issues.push(id + ': report-only agent WRITE_REPORTS must be SCOPED');
  }

  if (!isSafePath(profile.write_scope) || !isSafePath(profile.report_scope)) {
    issues.push(id + ': write/report scope is malformed');
  }
  if (profile.write_scope !== profile.report_scope) {
    issues.push(id + ': write_scope and report_scope must match');
  }
}

export function validateProfileContract(profile, expected, root = process.cwd()) {
  const issues = [];
  const id = expected.id;
  const required = [
    'agent_id', 'class', 'principal', 'registry_ref', 'mission',
    'read_scope', 'write_scope', 'execution_scope', 'forbidden_actions',
    'report_scope', 'evidence_contract', 'lifecycle', 'delegation_policy',
    'certification_authority', 'merge_authority', 'deploy_authority',
    'self_certification', 'dispatch_authority', 'parent_agent_id',
    'authority_inheritance', 'independent_review', 'capabilities_schema',
  ];
  for (const key of required) if (!(key in profile)) issues.push(id + ': missing ' + key);

  if (profile.agent_id !== id) issues.push(id + ': agent_id mismatch');
  if (profile.name !== expected.name) issues.push(id + ': name mismatch');
  if (profile.class !== expected.class) issues.push(id + ': class mismatch');
  if (profile.registry_ref !== 'الوكلاء.md#' + id) issues.push(id + ': registry_ref mismatch');
  if (profile.principal !== (expected.class === 'principal')) issues.push(id + ': principal classification mismatch');
  if (profile.parent_agent_id !== (expected.parent ?? 'none')) issues.push(id + ': parent_agent_id mismatch');
  if (profile.dispatch_authority !== (expected.dispatchAuthority ?? 'none')) issues.push(id + ': dispatch_authority mismatch');
  if (profile.authority_inheritance !== (expected.authorityInheritance ?? 'none')) issues.push(id + ': authority_inheritance mismatch');
  if (profile.independent_review !== Boolean(expected.independentReview)) issues.push(id + ': independent_review mismatch');
  if (profile.capabilities_schema !== 'flixo-agent-capabilities-v1') issues.push(id + ': unsupported capabilities schema');
  if (!LIFECYCLE_STATES.includes(profile.lifecycle)) issues.push(id + ': lifecycle is invalid');
  if (profile.lifecycle === 'BEHAVIORAL-OBSERVED') issues.push(id + ': behavioral lifecycle cannot be self-declared');
  if (profile.delegation_policy !== 'DENY_ALL') issues.push(id + ': delegation policy must be DENY_ALL');
  if (profile.execution_scope?.includes('main-mutation')) issues.push(id + ': execution scope cannot grant main mutation');
  if (!pathExists(root, expected.profile)) issues.push(id + ': canonical profile does not exist');
  if (expected.contract && !pathExists(root, expected.contract)) issues.push(id + ': canonical contract/package does not exist');
  if (expected.report && !expected.report.endsWith('/') && !expected.report.includes('#') && !pathExists(root, expected.report)) {
    issues.push(id + ': report target does not exist');
  }
  if (profile.write_scope !== expected.report) issues.push(id + ': write/report scope drifts from registry');
  validateCapabilityContract(profile, id, issues, expected);

  return issues;
}

function roleDrillRegistered(root, agent) {
  if (!existsSync(join(root, ROLE_DRILLS))) return false;
  const content = readFileSync(join(root, ROLE_DRILLS), 'utf8');
  return content.includes("'" + agent.name + "':");
}

function currentBehaviorEvidence(root, reportScope, sha) {
  if (!sha || !reportScope || !reportScope.endsWith('/')) return false;
  const path = join(root, reportScope);
  if (!existsSync(path) || !statSync(path).isDirectory()) return false;
  const stack = [path];
  while (stack.length) {
    const current = stack.pop();
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else if (st.isFile() && name.endsWith('.md')) {
        const text = readFileSync(full, 'utf8');
        if (text.includes('BEHAVIORAL-OBSERVED') && text.includes(sha)) return true;
      }
    }
  }
  return false;
}

export function deriveLifecycle({ contractValid, agent, root, sha }) {
  if (!contractValid) return 'BLOCKED';
  if (currentBehaviorEvidence(root, agent.report, sha)) return 'BEHAVIORAL-OBSERVED';
  if (agent.class === 'supporting-subrole') return 'READY-TEST';
  if (roleDrillRegistered(root, agent)) return 'READY-TEST';
  return 'READY-CONTRACT';
}

function parseTaskCards(content) {
  const start = content.indexOf('# ACTIVE DISPATCH QUEUE');
  const end = content.indexOf('# END ACTIVE DISPATCH QUEUE', start + 1);
  if (start < 0 || end < 0) return { cards: [], issues: ['task ledger active queue markers missing'] };
  const queue = content.slice(start, end);
  const matches = [...queue.matchAll(/^### ((?:EXEC|SCOUT)-[A-Z0-9-]+).*$/gmu)];
  const fieldOrder = ['TASK_ID','TYPE','PRIORITY','OWNER','STATUS','PR','SCOPE','DEPENDS_ON','SOURCE','EVIDENCE','ACCEPTANCE','NEXT_ACTION','COLLISION_KEY'];
  const cards = [];
  const issues = [];
  for (let i=0;i<matches.length;i++) {
    const from = matches[i].index;
    const to = i+1 < matches.length ? matches[i+1].index : queue.length;
    const block = queue.slice(from,to);
    const fields = {};
    for (const line of block.split('\n')) {
      const m = line.match(/^- \*\*([A-Z_]+):\*\* (.*)$/u);
      if (m) fields[m[1]] = m[2].trim();
    }
    const keys = Object.keys(fields);
    if (!fieldOrder.every((key, index) => keys[index] === key) || keys.length !== fieldOrder.length) {
      issues.push((matches[i][1]) + ': task card does not satisfy the strict 13-field contract');
    }
    if (!fields.TASK_ID || fields.TASK_ID !== matches[i][1]) issues.push(matches[i][1] + ': TASK_ID mismatch');
    cards.push({ ...fields, title: block.split('\n')[0].replace(/^### /u,'').replace(/^((?:EXEC|SCOUT)-[A-Z0-9-]+)\s+—?\s*/u,'') });
  }
  return { cards, issues };
}

export function deriveExecutionEnvelope(task, currentSha = null) {
  const directId = String(task.OWNER ?? '').match(/\bAGENT-\d{2}\b/);
  const agentId = directId?.[0] ?? 'UNBOUND';
  const bound = agentId !== 'UNBOUND';
  return {
    TASK_ID: task.TASK_ID,
    AGENT_ID: agentId,
    MISSION: task.title || task.ACCEPTANCE || '',
    STARTING_SHA: bound && task.STATUS !== 'QUEUED' ? currentSha : null,
    ALLOWED_CAPABILITIES: bound ? 'derived from Agent Contract ∩ task scope' : 'bound at CLAIM',
    READ_SCOPE: task.SCOPE || '',
    WRITE_SCOPE: task.SCOPE || '',
    FORBIDDEN_ACTIONS: 'agent contract + global policy',
    EXPECTED_EVIDENCE: task.EVIDENCE || 'none',
    ACCEPTANCE_CONDITIONS: task.ACCEPTANCE || '',
    HANDOFF_CONTRACT: 'exact-SHA + result + artifact/reference + negative-case',
    FINAL_SHA: null,
    bindingStatus: bound ? 'BOUND' : 'PENDING_CLAIM',
  };
}

export function auditExecutionEnvelope(root = process.cwd()) {
  const ledger = readFileSync(join(root, LEDGER), 'utf8');
  const requiredContract = [
    'EXECUTION ENVELOPE CONTRACT',
    'TASK-ID',
    'AGENT-ID',
    'STARTING-SHA',
    'ALLOWED-CAPABILITIES',
    'READ-SCOPE',
    'WRITE-SCOPE',
    'EXPECTED-EVIDENCE',
    'ACCEPTANCE-CONDITIONS',
    'HANDOFF-CONTRACT',
    'FINAL-SHA',
  ];
  const issues = [];
  for (const token of requiredContract) if (!ledger.includes(token)) issues.push('المهام.md: missing ' + token);
  const parsed = parseTaskCards(ledger);
  issues.push(...parsed.issues);
  const envelopes = parsed.cards.map(card => deriveExecutionEnvelope(card, gitHead(root)));
  return { cards: parsed.cards, envelopes, issues, activeTaskCount: parsed.cards.length };
}

export function auditAgentControlPlane(root = process.cwd(), sha = gitHead(root)) {
  const issues = [];
  const registry = loadCanonicalRegistry(root);
  if (registry.officialAgentCount !== 10 || registry.agents?.length !== 10) issues.push('canonical registry must contain exactly ten principal agents');
  const principals = registry.agents ?? [];
  const supports = registry.supportingRoles ?? [];
  if (supports.length !== 1) issues.push('canonical registry must contain exactly one supporting role');
  const all = [...principals, ...supports];
  const ids = all.map(a => a.id);
  if (new Set(ids).size !== ids.length) issues.push('agent ID collision');
  const profiles = localProfileNames(root);
  const expectedProfiles = all.map(a => a.profile.split('/').pop()).sort();
  if (JSON.stringify(profiles) !== JSON.stringify(expectedProfiles)) issues.push('profile set does not match canonical registry');

  const agents = all.map(agent => {
    const profilePath = join(root, agent.profile);
    const localIssues = [];
    try {
      const profile = parseProfileFrontmatter(readFileSync(profilePath, 'utf8'));
      localIssues.push(...validateProfileContract(profile, agent, root));
      const effectiveLifecycle = deriveLifecycle({ contractValid: localIssues.length === 0, agent: { ...agent, report: agent.report }, root, sha });
      if (profile.lifecycle === 'BEHAVIORAL-OBSERVED' && effectiveLifecycle !== 'BEHAVIORAL-OBSERVED') {
        localIssues.push(agent.id + ': lifecycle overclaim');
      }
      if (profile.lifecycle !== effectiveLifecycle) {
        localIssues.push(agent.id + ': declared lifecycle must equal the validator-derived lifecycle');
      }
      return { id: agent.id, name: agent.name, class: agent.class, declaredLifecycle: profile.lifecycle, effectiveLifecycle, issues: localIssues };
    } catch (error) {
      localIssues.push(agent.id + ': ' + error.message);
      return { id: agent.id, name: agent.name, class: agent.class, declaredLifecycle: null, effectiveLifecycle: 'BLOCKED', issues: localIssues };
    }
  });

  for (const agent of agents) issues.push(...agent.issues);
  const envelope = auditExecutionEnvelope(root);
  issues.push(...envelope.issues);

  return {
    sha,
    registry: { principalCount: principals.length, supportCount: supports.length, principalIds: principals.map(a => a.id) },
    agents,
    envelope,
    issues,
    status: issues.length === 0 ? 'PASS' : 'BLOCKED',
  };
}

if (process.argv[1]?.endsWith('agent-control-plane.mjs')) {
  const result = auditAgentControlPlane(process.cwd(), process.argv[2] ?? gitHead(process.cwd()));
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}

/* -------------------------------------------------------------------------- */
/* CELL HARD-CONTROL RUNTIME ENFORCEMENT                                      */
/* -------------------------------------------------------------------------- */

export const HARD_CONTROL_RUNTIME_VERSION = "1.0.0";
export const HARD_DRIFT_CODES = Object.freeze([
  "D1_SCOPE","D2_OBJECTIVE","D3_TOOL","D4_RESOURCE","D5_TEMPORAL",
  "D6_EVIDENCE","D7_AUTHORITY","D8_STRATEGY","D9_DELEGATION","D10_TRUTH_MEMORY",
]);

export const HARD_CONTROL_FAILURES = Object.freeze([
  "ADMISSION_BLOCK","DENY_BEFORE_MUTATION","TASK_ID_MISMATCH","AGENT_ID_MISMATCH",
  "MISSION_ID_MISMATCH","SESSION_ID_MISMATCH","BRANCH_DENIED","SCOPE_DENIED",
  "CAPABILITY_DENIED","SHA_STALE","LEASE_EXPIRED","STALE_FENCE","TOOL_DENIED",
  "RESOURCE_DENIED","BUDGET_EXCEEDED","DELEGATION_OVERFLOW","AUTHORITY_BYPASS",
  "IDEMPOTENCY_REPLAY","NETWORK_PARTITION","UNVERIFIABLE","CLOSURE_BLOCKED",
  "SOLVER_CANNOT_CLOSE","EVOLUTION_GOVERNANCE_BLOCK",
]);

export const HARD_RUNTIME_REQUIRED_ASSIGNMENT_FIELDS = Object.freeze([
  "assignmentId","taskId","missionId","solverId","opponentId","backupSolverId",
  "backupOpponentId","riskClass","oppositionPlan","falsificationPolicy",
  "independencePolicy","startingSha","scope","budget","delegationDepth","handoffPolicy",
]);

export const HARD_RUNTIME_TASK_STATES = Object.freeze([
  "QUEUED","ADMITTED","ASSIGNED","RUNNING","RECONCILING","VERIFYING",
  "BLOCKED","FAILED","READY_TO_CLOSE","CLOSED",
]);

export const HARD_RUNTIME_AGENT_STATES = Object.freeze([
  "DEFINED","READY","WORKING","DEGRADED","LOST","RECOVERABLE","QUARANTINED","RESTORED",
]);

const TASK_GRAPH = Object.freeze({
  QUEUED:["ADMITTED"],
  ADMITTED:["ASSIGNED","BLOCKED","FAILED"],
  ASSIGNED:["RUNNING","BLOCKED","FAILED"],
  RUNNING:["RECONCILING","VERIFYING","BLOCKED","FAILED"],
  RECONCILING:["RUNNING","VERIFYING","BLOCKED","FAILED"],
  VERIFYING:["RECONCILING","READY_TO_CLOSE","BLOCKED","FAILED"],
  BLOCKED:["QUEUED","ADMITTED","FAILED"],
  FAILED:["QUEUED","BLOCKED"],
  READY_TO_CLOSE:["VERIFYING","CLOSED"],
  CLOSED:[],
});

const AGENT_GRAPH = Object.freeze({
  DEFINED:["READY"],
  READY:["WORKING"],
  WORKING:["READY","DEGRADED","LOST"],
  DEGRADED:["WORKING","LOST"],
  LOST:["RECOVERABLE"],
  RECOVERABLE:["QUARANTINED"],
  QUARANTINED:["RESTORED"],
  RESTORED:["READY"],
});

const REQUIRED_EVIDENCE_KINDS = Object.freeze([
  "sourceSha","build","session","action","candidate","test",
  "opponent","redTeam","verifier","certification","promotion",
]);

const HARD_SHA_RE = /^[0-9a-f]{40}$/iu;
const HARD_HASH_RE = /^[0-9a-f]{64}$/iu;

function hardError(code, detail = "") {
  const error = new Error(code + (detail ? ":" + detail : ""));
  error.code = code;
  return error;
}

function required(value, code) {
  if (typeof value !== "string" || !value.trim()) throw hardError(code);
  return value.trim();
}

function validSha(value) {
  return HARD_SHA_RE.test(String(value ?? ""));
}

function validHash(value) {
  return HARD_HASH_RE.test(String(value ?? ""));
}

function freezeScope(scope) {
  const source = scope ?? {};
  const result = {
    read: [...(source.read ?? [])],
    write: [...(source.write ?? [])],
    branches: [...(source.branches ?? [])],
    tools: [...(source.tools ?? [])],
    resources: [...(source.resources ?? [])],
  };
  if (!result.read.length && !result.write.length) throw hardError("ADMISSION_BLOCK","SCOPE_REQUIRED");
  if (!result.branches.length || result.branches.includes("main")) throw hardError("ADMISSION_BLOCK","BRANCH_SCOPE_INVALID");
  if (!result.tools.length || !result.resources.length) throw hardError("ADMISSION_BLOCK","TOOL_RESOURCE_SCOPE_REQUIRED");
  return Object.freeze({
    read:Object.freeze(result.read),
    write:Object.freeze(result.write),
    branches:Object.freeze(result.branches),
    tools:Object.freeze(result.tools),
    resources:Object.freeze(result.resources),
  });
}

function freezeBudget(budget) {
  if (!budget || !Number.isFinite(budget.cost) || budget.cost < 0 || !Number.isFinite(budget.durationMs) || budget.durationMs <= 0) {
    throw hardError("ADMISSION_BLOCK","BUDGET_INVALID");
  }
  return Object.freeze({ cost:Number(budget.cost), durationMs:Number(budget.durationMs) });
}

function independent(ids) {
  return ids.every(Boolean) && new Set(ids).size === ids.length;
}

function transition(map, id, graph, next, mismatchCode, clock) {
  const current = map.get(id);
  if (!current) throw hardError("TASK_ID_MISMATCH");
  if (!(graph[current.state] ?? []).includes(next)) throw hardError("DENY_BEFORE_MUTATION", mismatchCode + ":" + current.state + "->" + next);
  const updated = Object.freeze({ ...current, state:next, version:current.version + 1, updatedAt:clock() });
  map.set(id, updated);
  return updated;
}

export class HardControlRuntime {
  constructor(options = {}) {
    const liveSha = options.liveSha ?? "0".repeat(40);
    if (!validSha(liveSha)) throw hardError("SHA_STALE","INVALID_LIVE_SHA");
    this.clock = options.clock ?? (() => Date.now());
    this.liveSha = liveSha;
    this.tasks = new Map();
    this.agents = new Map();
    this.assignments = new Map();
    this.sessions = new Map();
    this.evidence = new Map();
    this.reconciliations = new Map();
    this.redTeamResults = new Map();
    this.verifications = new Map();
    this.proposals = new Map();
    this.journal = new Map();
    this.effects = new Map();
    this.events = [];
    this.sequence = 0;
    this.metrics = {
      taskProgression:0, assignmentSuccess:0, assignmentAttempts:0,
      reassignmentCount:0, opponentYieldCount:0, opponentChecks:0,
      redTeamYieldCount:0, redTeamRuns:0, recoverySuccessCount:0, recoveryAttempts:0,
      evidenceStalenessCount:0, falseGreenBlocks:0, promotionAttempts:0,
      scopeViolations:0, thrashingCount:0, routingRegretCount:0,
    };
    this.partitioned = false;
  }

  registerTask(input) {
    const taskId = required(input?.taskId,"ADMISSION_BLOCK:TASK_REQUIRED");
    if (this.tasks.has(taskId)) throw hardError("ADMISSION_BLOCK","TASK_ALREADY_EXISTS");
    const task = Object.freeze({
      taskId,
      missionId:required(input.missionId,"ADMISSION_BLOCK:MISSION_REQUIRED"),
      state:"QUEUED",
      version:0,
      valid:input.valid !== false,
      requiredCapability:required(input.requiredCapability,"ADMISSION_BLOCK:CAPABILITY_REQUIRED"),
      riskClass:required(input.riskClass ?? "MEDIUM","ADMISSION_BLOCK:RISK_REQUIRED"),
      acceptance:required(input.acceptance,"ADMISSION_BLOCK:ACCEPTANCE_REQUIRED"),
      objectiveId:required(input.objectiveId ?? "OBJECTIVE-1","ADMISSION_BLOCK:OBJECTIVE_REQUIRED"),
      acceptanceDigest:required(input.acceptanceDigest ?? "ACCEPTANCE-1","ADMISSION_BLOCK:ACCEPTANCE_DIGEST_REQUIRED"),
      startingSha:required(input.startingSha ?? this.liveSha,"ADMISSION_BLOCK:START_SHA_REQUIRED"),
      scope:freezeScope(input.scope),
      createdAt:this.clock(),
      updatedAt:this.clock(),
    });
    if (!validSha(task.startingSha)) throw hardError("ADMISSION_BLOCK","STARTING_SHA_INVALID");
    this.tasks.set(taskId, task);
    return task;
  }

  registerAgent(input) {
    const agentId = required(input?.agentId,"ADMISSION_BLOCK:AGENT_REQUIRED");
    if (this.agents.has(agentId)) throw hardError("ADMISSION_BLOCK","AGENT_ALREADY_EXISTS");
    const agent = Object.freeze({
      agentId,
      state:input.state ?? "DEFINED",
      capabilities:Object.freeze([...(input.capabilities ?? [])]),
      scope:freezeScope(input.scope ?? { read:["**"], write:["tests/**"], branches:["execution"], tools:["test"], resources:["cpu"] }),
      riskClasses:Object.freeze([...(input.riskClasses ?? ["LOW","MEDIUM","HIGH","CRITICAL"])]),
      independenceKey:input.independenceKey ?? agentId,
      authority:Object.freeze([...(input.authority ?? ["READ","TEST"])]),
      version:0,
      lastSeen:this.clock(),
    });
    if (!HARD_RUNTIME_AGENT_STATES.includes(agent.state)) throw hardError("ADMISSION_BLOCK","AGENT_STATE_INVALID");
    if (!agent.capabilities.length) throw hardError("ADMISSION_BLOCK","AGENT_CAPABILITY_EMPTY");
    this.agents.set(agentId, agent);
    return agent;
  }

  transitionTask(taskId, next) {
    if (next === "READY_TO_CLOSE" || next === "CLOSED") throw hardError("DENY_BEFORE_MUTATION","CONTROLLED_CLOSURE_TRANSITION");
    const before = this.tasks.get(taskId);
    const result = transition(this.tasks, taskId, TASK_GRAPH, next, "INVALID_TASK_TRANSITION", this.clock);
    this.metrics.taskProgression += 1;
    this.events.push(Object.freeze({ type:"TASK_TRANSITION", taskId, from:before.state, to:next, at:this.clock() }));
    return result;
  }

  transitionAgent(agentId, next) {
    const current = this.agents.get(agentId);
    if (!current) throw hardError("AGENT_ID_MISMATCH");
    if (!(AGENT_GRAPH[current.state] ?? []).includes(next)) throw hardError("DENY_BEFORE_MUTATION","INVALID_AGENT_TRANSITION:" + current.state + "->" + next);
    const updated = Object.freeze({ ...current, state:next, version:current.version + 1, lastSeen:this.clock() });
    this.agents.set(agentId, updated);
    return updated;
  }

  createAssignment(input) {
    this.metrics.assignmentAttempts += 1;
    const task = this.tasks.get(input?.taskId);
    if (!task || !task.valid) throw hardError("ADMISSION_BLOCK","TASK_INVALID");
    if (task.state !== "QUEUED") throw hardError("ADMISSION_BLOCK","TASK_NOT_QUEUED");
    const assignment = {
      assignmentId:required(input.assignmentId,"ADMISSION_BLOCK:ASSIGNMENT_REQUIRED"),
      taskId:task.taskId,
      missionId:required(input.missionId,"ADMISSION_BLOCK:MISSION_REQUIRED"),
      solverId:required(input.solverId,"ADMISSION_BLOCK:SOLVER_REQUIRED"),
      opponentId:required(input.opponentId,"ADMISSION_BLOCK:OPPONENT_REQUIRED"),
      backupSolverId:required(input.backupSolverId,"ADMISSION_BLOCK:BACKUP_SOLVER_REQUIRED"),
      backupOpponentId:required(input.backupOpponentId,"ADMISSION_BLOCK:BACKUP_OPPONENT_REQUIRED"),
      riskClass:required(input.riskClass,"ADMISSION_BLOCK:RISK_REQUIRED"),
      oppositionPlan:required(input.oppositionPlan,"ADMISSION_BLOCK:OPPOSITION_PLAN_REQUIRED"),
      falsificationPolicy:required(input.falsificationPolicy,"ADMISSION_BLOCK:FALSIFICATION_POLICY_REQUIRED"),
      independencePolicy:required(input.independencePolicy,"ADMISSION_BLOCK:INDEPENDENCE_POLICY_REQUIRED"),
      startingSha:required(input.startingSha,"ADMISSION_BLOCK:STARTING_SHA_REQUIRED"),
      scope:freezeScope(input.scope),
      budget:freezeBudget(input.budget),
      delegationDepth:input.delegationDepth,
      handoffPolicy:required(input.handoffPolicy,"ADMISSION_BLOCK:HANDOFF_POLICY_REQUIRED"),
      verifierId:required(input.verifierId,"ADMISSION_BLOCK:VERIFIER_REQUIRED"),
      requiredCapability:required(input.requiredCapability ?? task.requiredCapability,"ADMISSION_BLOCK:CAPABILITY_REQUIRED"),
      acceptance:required(input.acceptance ?? task.acceptance,"ADMISSION_BLOCK:ACCEPTANCE_REQUIRED"),
      acceptanceDigest:required(input.acceptanceDigest ?? task.acceptanceDigest,"ADMISSION_BLOCK:ACCEPTANCE_DIGEST_REQUIRED"),
      objectiveId:required(input.objectiveId ?? task.objectiveId,"ADMISSION_BLOCK:OBJECTIVE_REQUIRED"),
      deadlineAt:input.deadlineAt ?? null,
      strategyId:input.strategyId ?? "STRATEGY-1",
    };
    if (!Number.isInteger(assignment.delegationDepth) || assignment.delegationDepth < 0) throw hardError("ADMISSION_BLOCK","DELEGATION_DEPTH_INVALID");
    if (assignment.missionId !== task.missionId) throw hardError("ADMISSION_BLOCK","MISSION_MISMATCH");
    if (assignment.riskClass !== task.riskClass) throw hardError("ADMISSION_BLOCK","RISK_POLICY_MISMATCH");
    if (assignment.startingSha !== task.startingSha || assignment.startingSha !== this.liveSha || !validSha(assignment.startingSha)) throw hardError("ADMISSION_BLOCK","STARTING_SHA_INVALID");
    if (assignment.acceptance !== task.acceptance || assignment.acceptanceDigest !== task.acceptanceDigest) throw hardError("ADMISSION_BLOCK","ACCEPTANCE_MISMATCH");
    if (assignment.requiredCapability !== task.requiredCapability) throw hardError("ADMISSION_BLOCK","CAPABILITY_MISMATCH");
    if (!assignment.scope.branches.includes("execution") || assignment.scope.branches.includes("main")) throw hardError("ADMISSION_BLOCK","BRANCH_SCOPE_INVALID");
    const ids = [assignment.solverId,assignment.opponentId,assignment.backupSolverId,assignment.backupOpponentId,assignment.verifierId];
    if (!independent(ids)) throw hardError("ADMISSION_BLOCK","ROLE_INDEPENDENCE_VIOLATION");
    for (const id of ids) {
      const agent = this.agents.get(id);
      if (!agent || agent.state !== "READY") throw hardError("ADMISSION_BLOCK","AGENT_NOT_READY:" + id);
      if (!agent.riskClasses.includes(assignment.riskClass)) throw hardError("ADMISSION_BLOCK","RISK_CLASS_NOT_SUPPORTED:" + id);
    }
    for (const id of [assignment.solverId,assignment.opponentId,assignment.backupSolverId,assignment.backupOpponentId]) {
      if (!this.agents.get(id).capabilities.includes(assignment.requiredCapability)) throw hardError("ADMISSION_BLOCK","CAPABILITY_NOT_SUPPORTED:" + id);
    }
    const solver = this.agents.get(assignment.solverId);
    const opponent = this.agents.get(assignment.opponentId);
    if (!solver.independenceKey || solver.independenceKey === opponent.independenceKey) throw hardError("ADMISSION_BLOCK","INDEPENDENCE_POLICY_FAILED");
    if (this.assignments.has(assignment.assignmentId)) throw hardError("ADMISSION_BLOCK","ASSIGNMENT_ALREADY_EXISTS");
    const frozen = Object.freeze({ ...assignment });
    this.assignments.set(frozen.assignmentId, frozen);
    this.transitionTask(task.taskId,"ADMITTED");
    this.metrics.assignmentSuccess += 1;
    this.events.push(Object.freeze({ type:"ASSIGNMENT_ADMITTED", assignmentId:frozen.assignmentId, at:this.clock() }));
    return this.envelopeFor(frozen);
  }

  envelopeFor(assignment) {
    return Object.freeze({
      taskId:assignment.taskId, missionId:assignment.missionId, assignmentId:assignment.assignmentId,
      solverId:assignment.solverId, opponentId:assignment.opponentId,
      backupSolverId:assignment.backupSolverId, backupOpponentId:assignment.backupOpponentId,
      requiredCapability:assignment.requiredCapability, startingSha:assignment.startingSha,
      scope:assignment.scope, budget:assignment.budget, delegationDepth:assignment.delegationDepth,
      riskClass:assignment.riskClass, oppositionPlan:assignment.oppositionPlan,
      falsificationPolicy:assignment.falsificationPolicy, independencePolicy:assignment.independencePolicy,
      handoffPolicy:assignment.handoffPolicy, verifierId:assignment.verifierId,
      objectiveId:assignment.objectiveId, acceptance:assignment.acceptance,
      acceptanceDigest:assignment.acceptanceDigest,
    });
  }

  startSession(assignmentId, input = {}) {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) throw hardError("ADMISSION_BLOCK","ASSIGNMENT_NOT_FOUND");
    const task = this.tasks.get(assignment.taskId);
    if (task.state !== "ADMITTED") throw hardError("DENY_BEFORE_MUTATION","SESSION_TASK_STATE");
    const sessionId = required(input.sessionId ?? ("session-" + (++this.sequence)),"SESSION_ID_MISMATCH");
    const ownerId = required(input.ownerId ?? assignment.solverId,"AGENT_ID_MISMATCH");
    const existing = this.sessions.get(sessionId);
    if (existing) {
      if (existing.assignmentId !== assignmentId || existing.ownerId !== ownerId) throw hardError("SESSION_ID_MISMATCH");
      if (this.clock() < existing.lease.expiresAt) return existing;
      throw hardError("LEASE_EXPIRED");
    if (ownerId !== assignment.solverId) throw hardError("AGENT_ID_MISMATCH");
    const now = this.clock();
    const ttlMs = input.ttlMs ?? 10_000;
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw hardError("LEASE_EXPIRED","INVALID_TTL");
    this.transitionTask(task.taskId,"ASSIGNED");
    this.transitionTask(task.taskId,"RUNNING");
    const lease = Object.freeze({
      leaseId:"lease-" + (++this.sequence),
      ownerId,
      issuedAt:now,
      expiresAt:now + ttlMs,
      heartbeat:now,
      fenceToken:++this.sequence,
      idempotencyKey:assignment.assignmentId + ":" + sessionId,
    });
    const session = Object.freeze({
      sessionId, assignmentId, taskId:assignment.taskId, missionId:assignment.missionId,
      ownerId, lease, openedAt:now, version:0,
    });
    this.sessions.set(sessionId, session);
    return session;
  }

  heartbeatLease(sessionId, input = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw hardError("SESSION_ID_MISMATCH");
    const now = this.clock();
    if (now >= session.lease.expiresAt) throw hardError("LEASE_EXPIRED");
    if (input.ownerId !== session.ownerId || input.leaseId !== session.lease.leaseId || input.fenceToken !== session.lease.fenceToken) throw hardError("STALE_FENCE");
    const ttlMs = Number(input.ttlMs ?? Math.max(1,session.lease.expiresAt - session.lease.issuedAt));
    if (ttlMs <= 0 || !Number.isFinite(ttlMs)) throw hardError("LEASE_EXPIRED","INVALID_TTL");
    const lease = Object.freeze({ ...session.lease, expiresAt:now + ttlMs, heartbeat:now });
    const next = Object.freeze({ ...session, lease, version:session.version + 1 });
    this.sessions.set(sessionId,next);
    return next;
  }

  setLiveSha(sha) {
    if (!validSha(sha)) throw hardError("SHA_STALE","INVALID_SHA");
    this.liveSha = sha;
  }

  setPartitioned(value) {
    this.partitioned = Boolean(value);
  }

  mutationEffectCount(idempotencyKey) {
    return this.effects.get(idempotencyKey)?.count ?? 0;
  }

  authorizeMutation(input) {
    const request = input ?? {};
    const session = this.sessions.get(request.sessionId);
    const task = this.tasks.get(request.taskId);
    if (!task || task.state !== "RUNNING") return this.deny("DENY_BEFORE_MUTATION","TASK_NOT_RUNNING");
    if (!session) return this.deny("SESSION_ID_MISMATCH");
    const assignment = this.assignments.get(session.assignmentId);
    if (!assignment || assignment.taskId !== task.taskId) return this.deny("TASK_ID_MISMATCH");
    if (request.taskId !== assignment.taskId) return this.deny("TASK_ID_MISMATCH");
    if (request.agentId !== session.ownerId) return this.deny("AGENT_ID_MISMATCH");
    if (request.missionId !== assignment.missionId || request.missionId !== session.missionId) return this.deny("MISSION_ID_MISMATCH");
    if (!validSha(request.startingSha) || request.startingSha !== assignment.startingSha || request.startingSha !== task.startingSha) return this.deny("SHA_STALE");
    if (!validSha(request.currentSha) || request.currentSha !== this.liveSha) return this.deny("SHA_STALE");
    if (this.clock() >= session.lease.expiresAt) return this.deny("LEASE_EXPIRED");
    if (request.leaseId !== session.lease.leaseId) return this.deny("LEASE_EXPIRED");
    if (request.fenceToken !== session.lease.fenceToken) return this.deny("STALE_FENCE");
    const agent = this.agents.get(request.agentId);
    if (!agent) return this.deny("AGENT_ID_MISMATCH");
    if (agent.state !== "WORKING") return this.deny("AUTHORITY_BYPASS","AGENT_NOT_WORKING");
    if (!agent.capabilities.includes(request.capability) || request.capability !== assignment.requiredCapability) return this.deny("CAPABILITY_DENIED");
    if (this.partitioned) return this.deny("NETWORK_PARTITION");
    if (!assignment.scope.branches.includes(request.branch) || request.branch === "main") return this.deny("BRANCH_DENIED");
    if (!assignment.scope.tools.includes(request.toolId)) return this.deny("TOOL_DENIED");
    if (!assignment.scope.resources.includes(request.resource)) return this.deny("RESOURCE_DENIED");
    const operation = String(request.operation ?? "WRITE");
    const requiredAuthority = operation === "WRITE" ? "WRITE" : operation === "DELEGATE" ? "DELEGATE" : operation === "COMMIT" ? "COMMIT" : "TEST";
    if (!agent.authority.includes(requiredAuthority)) return this.deny("AUTHORITY_BYPASS");
    if (Number(request.delegationDepth) > assignment.delegationDepth) return this.deny("DELEGATION_OVERFLOW");
    if (operation === "WRITE") {
      const normalized = String(request.path ?? "").replaceAll("\\","/");
      if (!normalized || !assignment.scope.write.some((scope) => this.pathMatches(normalized.replaceAll("\\","/"),scope))) return this.deny("SCOPE_DENIED");
    }
    if (operation === "READ") {
      const normalized = String(request.path ?? "").replaceAll("\\","/");
      if (!normalized || !assignment.scope.read.some((scope) => this.pathMatches(normalized,scope))) return this.deny("SCOPE_DENIED");
    }
    const estimatedCost = Number(request.estimatedCost);
    const estimatedDurationMs = Number(request.estimatedDurationMs);
    if (!Number.isFinite(estimatedCost) || estimatedCost < 0 || !Number.isFinite(estimatedDurationMs) || estimatedDurationMs < 0) return this.deny("RESOURCE_DENIED");
    const currentUsage = this.getBudgetUsage(task.taskId);
    if (currentUsage.cost + estimatedCost > assignment.budget.cost || currentUsage.durationMs + estimatedDurationMs > assignment.budget.durationMs) return this.deny("BUDGET_EXCEEDED");
    const key = required(request.idempotencyKey,"IDEMPOTENCY_REPLAY");
    if (this.journal.has(key) || this.effects.has(key)) return Object.freeze({ allowed:true, effectApplied:false, duplicate:true, code:"IDEMPOTENCY_REPLAY" });

    /* Every deny above occurs before this point. The first durable mutation starts here. */
    this.journal.set(key,Object.freeze({
      status:"PENDING", at:this.clock(), actionId:request.actionId ?? null, taskId:task.taskId,
      cost:estimatedCost, durationMs:estimatedDurationMs,
    }));
    const prior = this.effects.get(key) ?? { count:0 };
    this.effects.set(key,Object.freeze({
      count:prior.count + 1, taskId:task.taskId, sessionId:session.sessionId,
      actionId:request.actionId ?? null, at:this.clock(),
    }));
    this.journal.set(key,Object.freeze({
      status:"APPLIED", at:this.clock(), actionId:request.actionId ?? null, taskId:task.taskId,
      cost:estimatedCost, durationMs:estimatedDurationMs,
    }));
    this.events.push(Object.freeze({ type:"MUTATION", taskId:task.taskId, actionId:request.actionId ?? null, at:this.clock() }));
    return Object.freeze({ allowed:true, effectApplied:true, duplicate:false, code:"ALLOW" });
  }

  deny(code, detail = "") {
    if (["SCOPE_DENIED","BRANCH_DENIED","TOOL_DENIED","RESOURCE_DENIED"].includes(code)) this.metrics.scopeViolations += 1;
    this.events.push(Object.freeze({ type:"DENY_BEFORE_MUTATION", code, detail, at:this.clock() }));
    return Object.freeze({ allowed:false, effectApplied:false, duplicate:false, code, detail });
  }

  pathMatches(path, pattern) {
    const escaped = String(pattern).replace(/[.+?^$()|[\]\\]/g,"\\$&").replaceAll("**","§").replaceAll("*","[^/]*").replaceAll("§",".*");
    return new RegExp("^" + escaped + "$","u").test(path);
  }

  getBudgetUsage(taskId) {
    let cost = 0;
    let durationMs = 0;
    for (const entry of this.journal.values()) {
      if (entry.status === "APPLIED" && entry.taskId === taskId) {
        cost += Number(entry.cost ?? 0);
        durationMs += Number(entry.durationMs ?? 0);
      }
    }
    return { cost, durationMs };
  }

  reconcile(taskId, input) {
    const task = this.tasks.get(taskId);
    if (!task) throw hardError("TASK_ID_MISMATCH");
    if (task.state !== "RUNNING") throw hardError("DENY_BEFORE_MUTATION","RECONCILIATION_STATE");
    this.transitionTask(taskId,"RECONCILING");
    const solver = String(input?.solverOutcome ?? "UNKNOWN");
    const opponent = String(input?.opponentOutcome ?? "UNKNOWN");
    this.metrics.opponentChecks += 1;
    if (opponent === "COUNTEREXAMPLE") this.metrics.opponentYieldCount += 1;
    let decision = "MORE_EVIDENCE";
    if (solver === "SUCCESS" && opponent === "COUNTEREXAMPLE") {
      const risk = task.riskClass;
      decision = ["HIGH","CRITICAL"].includes(risk) ? "ESCALATE" : risk === "MEDIUM" ? "REPLAN" : "MORE_EVIDENCE";
      if (decision === "REPLAN") this.metrics.thrashingCount += 1;
    }
    const result = Object.freeze({ taskId, state:"RECONCILING", solverOutcome:solver, opponentOutcome:opponent, decision });
    this.reconciliations.set(taskId,result);
    return result;
  }

  redTeamGate(taskId, input) {
    const task = this.tasks.get(taskId);
    if (!task) throw hardError("TASK_ID_MISMATCH");
    this.metrics.redTeamRuns += 1;
    const riskRequiresGate = ["HIGH","CRITICAL"].includes(task.riskClass);
    const requiredGate = riskRequiresGate || input?.required !== false;
    const findings = Number(input?.findings ?? 0);
    const remediated = input?.remediated === true;
    const retested = input?.retested === true;
    const pass = !requiredGate || (findings === 0 && remediated && retested);
    if (findings > 0) this.metrics.redTeamYieldCount += 1;
    const result = Object.freeze({ taskId, required:requiredGate, findings, remediated, retested, pass, gate:pass ? "PASS" : "BLOCK" });
    this.redTeamResults.set(taskId,result);
    return result;
  }

  recordVerification(taskId, input = {}) {
    const task = this.tasks.get(taskId);
    if (!task || task.state !== "VERIFYING") throw hardError("DENY_BEFORE_MUTATION","VERIFICATION_STATE");
    const assignment = [...this.assignments.values()].find((candidate) => candidate.taskId === taskId);
    const verifierId = required(input.verifierId,"AUTHORITY_BYPASS:VERIFIER_REQUIRED");
    if (!assignment || verifierId !== assignment.verifierId) throw hardError("AUTHORITY_BYPASS","VERIFIER_ID");
    const result = Object.freeze({
      taskId, verifierId, pass:input.pass === true, certificationPass:input.certificationPass === true,
      reviewedAt:this.clock(), reviewId:required(input.reviewId ?? "REVIEW-1","AUTHORITY_BYPASS:REVIEW_REQUIRED"),
    });
    this.verifications.set(taskId,result);
    return result;
  }

  prepareVerification(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw hardError("TASK_ID_MISMATCH");
    if (!["RUNNING","RECONCILING"].includes(task.state)) throw hardError("DENY_BEFORE_MUTATION","VERIFYING_STATE");
    return this.transitionTask(taskId,"VERIFYING");
  }

  markReadyToClose(taskId, input) {
    const task = this.tasks.get(taskId);
    if (!task) throw hardError("TASK_ID_MISMATCH");
    if (task.state !== "VERIFYING") throw hardError("DENY_BEFORE_MUTATION","READY_TO_CLOSE_STATE");
    const reconciliation = this.reconciliations.get(taskId);
    const redTeam = this.redTeamResults.get(taskId);
    const verification = this.verifications.get(taskId);
    const evidence = this.verifyEvidenceChain({ through:"certification" });
    const pass =
      reconciliation?.opponentOutcome === "PASS" &&
      redTeam?.pass === true &&
      verification?.pass === true &&
      verification?.certificationPass === true &&
      evidence.pass === true;
    if (!pass) return this.deny("CLOSURE_BLOCKED","MORE_EVIDENCE/REPLAN/ESCALATE");
    return transition(this.tasks,taskId,TASK_GRAPH,"READY_TO_CLOSE","INVALID_TASK_TRANSITION",this.clock);
  }

  attemptPromotion(taskId, input) {
    this.metrics.promotionAttempts += 1;
    const task = this.tasks.get(taskId);
    const assignment = task ? [...this.assignments.values()].find((candidate) => candidate.taskId === taskId) : null;
    if (!task || !assignment) return this.deny("DENY_BEFORE_MUTATION","PROMOTION_CONTEXT");
    if (input?.actorId === assignment.solverId || input?.actorRole === "SOLVER") {
      this.metrics.falseGreenBlocks += 1;
      return this.deny("SOLVER_CANNOT_CLOSE");
    }
    if (input?.actorId !== assignment.verifierId || input?.actorRole !== "VERIFIER") {
      this.metrics.falseGreenBlocks += 1;
      return this.deny("AUTHORITY_BYPASS","VERIFIER_ONLY_PROMOTION");
    }
    const reconciliation = this.reconciliations.get(taskId);
    const redTeam = this.redTeamResults.get(taskId);
    const verification = this.verifications.get(taskId);
    const evidence = this.verifyEvidenceChain();
    const gatesPass = task.state === "READY_TO_CLOSE" &&
      reconciliation?.opponentOutcome === "PASS" &&
      redTeam?.pass === true &&
      verification?.pass === true &&
      verification?.certificationPass === true &&
      evidence.pass === true;
    if (!gatesPass) {
      this.metrics.falseGreenBlocks += 1;
      return this.deny("CLOSURE_BLOCKED","PROMOTION_GATE");
    }
    transition(this.tasks,taskId,TASK_GRAPH,"CLOSED","INVALID_TASK_TRANSITION",this.clock);
    return Object.freeze({ allowed:true, promoted:true, code:"PROMOTED" });
  }

  crashAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) throw hardError("AGENT_ID_MISMATCH");
    if (["LOST","RECOVERABLE","QUARANTINED","RESTORED"].includes(agent.state)) return agent;
    const lost = this.transitionAgent(agentId,"LOST");
    for (const assignment of this.assignments.values()) {
      if ([assignment.solverId,assignment.opponentId].includes(agentId)) {
        const task = this.tasks.get(assignment.taskId);
        if (task && !["CLOSED","FAILED"].includes(task.state)) {
          if (["RUNNING","RECONCILING","VERIFYING","ASSIGNED","ADMITTED"].includes(task.state)) {
            try { this.transitionTask(task.taskId,"BLOCKED"); } catch { /* a concurrent controller may already have blocked the task */ }
          }
        }
        this.events.push(Object.freeze({ type:"AGENT_LOST_TASK_SURVIVED", agentId, taskId:assignment.taskId, at:this.clock() }));
      }
    }
    return lost;
  }

  reassign(assignmentId) {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) throw hardError("ADMISSION_BLOCK","ASSIGNMENT_NOT_FOUND");
    let next = assignment;
    if (this.agents.get(next.solverId)?.state === "LOST") next = Object.freeze({ ...next, solverId:next.backupSolverId, backupSolverId:next.solverId });
    if (this.agents.get(next.opponentId)?.state === "LOST") next = Object.freeze({ ...next, opponentId:next.backupOpponentId, backupOpponentId:next.opponentId });
    if (next.solverId === assignment.solverId && next.opponentId === assignment.opponentId) return next;
    const roleIds = [next.solverId,next.opponentId,next.backupSolverId,next.backupOpponentId,next.verifierId];
    if (!independent(roleIds)) throw hardError("ADMISSION_BLOCK","REASSIGNMENT_INDEPENDENCE");
    this.assignments.set(assignmentId,next);
    this.metrics.reassignmentCount += 1;
    this.metrics.routingRegretCount += 1;
    const task = this.tasks.get(assignment.taskId);
    if (task?.state === "BLOCKED") {
      this.transitionTask(task.taskId,"ADMITTED");
      this.transitionTask(task.taskId,"ASSIGNED");
      this.transitionTask(task.taskId,"RUNNING");
    }
    return next;
  }

  recoverAgent(agentId) {
    this.metrics.recoveryAttempts += 1;
    const current = this.agents.get(agentId);
    if (!current || current.state !== "LOST") throw hardError("DENY_BEFORE_MUTATION","RECOVERY_STATE");
    this.transitionAgent(agentId,"RECOVERABLE");
    this.transitionAgent(agentId,"QUARANTINED");
    this.transitionAgent(agentId,"RESTORED");
    this.metrics.recoverySuccessCount += 1;
    return this.agents.get(agentId);
  }

  simulatePartialWrite(idempotencyKey, taskId) {
    const key = required(idempotencyKey,"IDEMPOTENCY_REPLAY");
    if (this.journal.has(key) || this.effects.has(key)) return Object.freeze({ status:"DUPLICATE", effectApplied:false });
    this.journal.set(key,Object.freeze({ status:"PENDING", taskId, actionId:"PARTIAL", at:this.clock(), cost:0, durationMs:0 }));
    return Object.freeze({ status:"PENDING", effectApplied:false });
  }

  recoverPartialWrites() {
    let recovered = 0;
    for (const [key, entry] of this.journal.entries()) {
      if (entry.status === "PENDING") {
        this.journal.set(key,Object.freeze({ ...entry, status:"ABORTED", recoveredAt:this.clock() }));
        recovered += 1;
      }
    }
    return recovered;
  }

  restart(component) {
    this.events.push(Object.freeze({ type:"RESTART", component, at:this.clock() }));
    return HardControlRuntime.fromSnapshot(this.snapshot(),{ clock:this.clock, liveSha:this.liveSha });
  }

  snapshot() {
    return {
      version:HARD_CONTROL_RUNTIME_VERSION, liveSha:this.liveSha,
      tasks:[...this.tasks.values()], agents:[...this.agents.values()],
      assignments:[...this.assignments.values()], sessions:[...this.sessions.values()],
      evidence:[...this.evidence.values()], reconciliations:[...this.reconciliations.values()],
      redTeamResults:[...this.redTeamResults.values()], verifications:[...this.verifications.values()],
      proposals:[...this.proposals.values()],
      journal:[...this.journal.entries()], effects:[...this.effects.entries()], events:[...this.events],
      sequence:this.sequence, metrics:{...this.metrics}, partitioned:this.partitioned,
    };
  }

  static fromSnapshot(snapshot, options = {}) {
    if (!snapshot || snapshot.version !== HARD_CONTROL_RUNTIME_VERSION) throw hardError("UNVERIFIABLE","SNAPSHOT_VERSION");
    const rt = new HardControlRuntime({ ...options, liveSha:options.liveSha ?? snapshot.liveSha });
    for (const value of snapshot.tasks ?? []) rt.tasks.set(value.taskId,value);
    for (const value of snapshot.agents ?? []) rt.agents.set(value.agentId,value);
    for (const value of snapshot.assignments ?? []) rt.assignments.set(value.assignmentId,value);
    for (const value of snapshot.sessions ?? []) rt.sessions.set(value.sessionId,value);
    for (const value of snapshot.evidence ?? []) rt.evidence.set(value.id,value);
    for (const value of snapshot.reconciliations ?? []) rt.reconciliations.set(value.taskId,value);
    for (const value of snapshot.redTeamResults ?? []) rt.redTeamResults.set(value.taskId,value);
    for (const value of snapshot.verifications ?? []) rt.verifications.set(value.taskId,value);
    for (const value of snapshot.proposals ?? []) rt.proposals.set(value.proposalId,value);
    for (const [key,value] of snapshot.journal ?? []) rt.journal.set(key,value);
    for (const [key,value] of snapshot.effects ?? []) rt.effects.set(key,value);
    rt.events = [...(snapshot.events ?? [])];
    rt.sequence = snapshot.sequence ?? 0;
    rt.metrics = { ...rt.metrics, ...(snapshot.metrics ?? {}) };
    rt.partitioned = Boolean(snapshot.partitioned);
    return rt;
  }

  recordEvidenceNode(node) {
    try {
      required(node?.id,"UNVERIFIABLE");
      required(node?.identity,"UNVERIFIABLE");
      required(node?.version,"UNVERIFIABLE");
      if (!validHash(node.hash) || !Number.isFinite(node.timestamp)) throw hardError("UNVERIFIABLE");
      if (!REQUIRED_EVIDENCE_KINDS.includes(node.kind)) throw hardError("UNVERIFIABLE");
      if (this.evidence.has(node.id)) throw hardError("UNVERIFIABLE","DUPLICATE_ID");
      if (node.parent !== null && !this.evidence.has(node.parent)) throw hardError("UNVERIFIABLE","MISSING_PARENT");
      if (node.hash !== hardEvidenceHash(node)) throw hardError("UNVERIFIABLE","HASH_MISMATCH");
      const value = Object.freeze({ id:node.id, kind:node.kind, hash:node.hash, identity:node.identity, version:node.version, timestamp:node.timestamp, parent:node.parent });
      this.evidence.set(node.id,value);
      return value;
    } catch (error) {
      this.metrics.evidenceStalenessCount += 1;
      throw hardError("UNVERIFIABLE",error.code ?? error.message);
    }
  }

  verifyEvidenceChain(options = {}) {
    const through = options.through ?? "promotion";
    const endIndex = REQUIRED_EVIDENCE_KINDS.indexOf(through);
    if (endIndex < 0) return Object.freeze({ pass:false, code:"UNVERIFIABLE", reason:"UNKNOWN_EVIDENCE_BOUNDARY" });
    const requiredKinds = REQUIRED_EVIDENCE_KINDS.slice(0,endIndex + 1);
    const nodes = [...this.evidence.values()];
    const byKind = new Map(nodes.map((node) => [node.kind,node]));
    const missing = requiredKinds.filter((kind) => !byKind.has(kind));
    if (missing.length) return Object.freeze({ pass:false, code:"UNVERIFIABLE", missing });
    for (let i=0;i<requiredKinds.length;i += 1) {
      const node = byKind.get(requiredKinds[i]);
      if (!node) return Object.freeze({ pass:false, code:"UNVERIFIABLE", missing:[REQUIRED_EVIDENCE_KINDS[i]] });
      if (i === 0) {
        if (node.parent !== null) return Object.freeze({ pass:false, code:"UNVERIFIABLE", reason:"ROOT_PARENT" });
      } else {
        const parent = byKind.get(requiredKinds[i - 1]);
        if (!parent || node.parent !== parent.id) return Object.freeze({ pass:false, code:"UNVERIFIABLE", reason:"PARENT_MISMATCH" });
      }
      if (!validHash(node.hash) || !node.identity || !node.version || !Number.isFinite(node.timestamp) || node.hash !== hardEvidenceHash(node)) return Object.freeze({ pass:false, code:"UNVERIFIABLE", reason:"NODE_HASH_MISMATCH" });
    }
    return Object.freeze({ pass:true, code:"VERIFIED", count:nodes.length });
  }

  classifyEvidenceSha(evidenceSha) {
    const current = String(evidenceSha ?? "") === this.liveSha;
    if (!current) this.metrics.evidenceStalenessCount += 1;
    return current ? "CURRENT" : "STALE";
  }

  detectScopeDrift(input) {
    const assignment = this.assignments.get(input?.assignmentId);
    const task = assignment ? this.tasks.get(assignment.taskId) : null;
    if (!assignment || !task) return [Object.freeze({ type:"D7_AUTHORITY",response:"QUARANTINE",reason:"assignment missing" })];
    const findings = [];
    const push = (type,response,reason) => findings.push(Object.freeze({ type,response,reason }));
    if (input.path && !assignment.scope.write.some((s)=>this.pathMatches(input.path.replaceAll("\\","/"),s))) push("D1_SCOPE","PAUSE","scope path changed");
    if (input.branch && (!assignment.scope.branches.includes(input.branch) || input.branch === "main")) push("D1_SCOPE","PAUSE","branch changed");
    if (input.objectiveId && input.objectiveId !== assignment.objectiveId) push("D2_OBJECTIVE","REPLAN","objective changed");
    if (input.toolId && !assignment.scope.tools.includes(input.toolId)) push("D3_TOOL","PAUSE","tool changed");
    if (input.resource && !assignment.scope.resources.includes(input.resource)) push("D4_RESOURCE","PAUSE","resource changed");
    if (assignment.deadlineAt !== null && Number.isFinite(input.now) && input.now > assignment.deadlineAt) push("D5_TEMPORAL","PAUSE","deadline exceeded");
    if (input.currentSha && input.currentSha !== this.liveSha) push("D6_EVIDENCE","INVALIDATE","evidence SHA stale");
    if (input.agentId && ![assignment.solverId,assignment.opponentId,assignment.verifierId].includes(input.agentId)) push("D7_AUTHORITY","QUARANTINE","actor outside assignment");
    if (input.strategyId && input.strategyId !== assignment.strategyId) push("D8_STRATEGY","REPLAN","strategy changed");
    if (Number.isFinite(input.delegationDepth) && input.delegationDepth > assignment.delegationDepth) push("D9_DELEGATION","PAUSE","delegation depth exceeded");
    if (input.memorySourceSha && input.memorySourceSha !== this.liveSha) push("D10_TRUTH_MEMORY","INVALIDATE","memory source stale");
    if (findings.length) this.metrics.scopeViolations += findings.length;
    return Object.freeze(findings);
  }

  proposeSelfEvolution(input) {
    const task = this.tasks.get(input?.taskId);
    if (!task) throw hardError("EVOLUTION_GOVERNANCE_BLOCK","CANONICAL_TASK_REQUIRED");
    const proposalId = required(input.proposalId,"EVOLUTION_GOVERNANCE_BLOCK:PROPOSAL_REQUIRED");
    if (this.proposals.has(proposalId)) throw hardError("EVOLUTION_GOVERNANCE_BLOCK","PROPOSAL_ALREADY_EXISTS");
    const proposal = Object.freeze({
      proposalId, taskId:task.taskId, state:"PROPOSED",
      weakness:required(input.weakness,"EVOLUTION_GOVERNANCE_BLOCK:WEAKNESS_REQUIRED"),
      hypothesis:required(input.hypothesis,"EVOLUTION_GOVERNANCE_BLOCK:HYPOTHESIS_REQUIRED"),
      experiment:required(input.experiment,"EVOLUTION_GOVERNANCE_BLOCK:EXPERIMENT_REQUIRED"),
      opponentId:required(input.opponentId,"EVOLUTION_GOVERNANCE_BLOCK:OPPONENT_REQUIRED"),
      redTeamPlan:required(input.redTeamPlan,"EVOLUTION_GOVERNANCE_BLOCK:RED_TEAM_REQUIRED"),
      verificationPlan:required(input.verificationPlan,"EVOLUTION_GOVERNANCE_BLOCK:VERIFY_REQUIRED"),
      adoptionTaskId:task.taskId,
      reviewId:required(input.reviewId,"EVOLUTION_GOVERNANCE_BLOCK:REVIEW_REQUIRED"),
      verificationId:required(input.verificationId,"EVOLUTION_GOVERNANCE_BLOCK:VERIFICATION_REQUIRED"),
      createdAt:this.clock(),
    });
    this.proposals.set(proposalId,proposal);
    return proposal;
  }

  adoptSelfEvolution(proposalId, gate) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw hardError("EVOLUTION_GOVERNANCE_BLOCK","PROPOSAL_NOT_FOUND");
    const task = this.tasks.get(proposal.adoptionTaskId);
    const allowed = Boolean(
      gate?.canonicalTaskId === proposal.adoptionTaskId &&
      gate?.reviewId === proposal.reviewId &&
      gate?.verificationId === proposal.verificationId &&
      gate?.independentReview === true && gate?.verified === true &&
      gate?.redTeamPass === true && gate?.evidencePass === true &&
      task?.state === "READY_TO_CLOSE",
    );
    if (!allowed) throw hardError("EVOLUTION_GOVERNANCE_BLOCK");
    const adopted = Object.freeze({ ...proposal, state:"ADOPTED", adoptedAt:this.clock() });
    this.proposals.set(proposalId,adopted);
    return adopted;
  }

  metricsSnapshot() {
    const rate = (num,den) => den > 0 ? Number((num / den).toFixed(6)) : 0;
    return Object.freeze({
      task_progression:this.metrics.taskProgression,
      assignment_success:this.metrics.assignmentSuccess,
      reassignment_rate:rate(this.metrics.reassignmentCount,this.metrics.assignmentSuccess),
      opponent_yield:rate(this.metrics.opponentYieldCount,this.metrics.opponentChecks),
      red_team_yield:rate(this.metrics.redTeamYieldCount,this.metrics.redTeamRuns),
      recovery_success:rate(this.metrics.recoverySuccessCount,this.metrics.recoveryAttempts),
      evidence_staleness:this.metrics.evidenceStalenessCount,
      false_green_rate:rate(this.metrics.falseGreenBlocks,this.metrics.promotionAttempts),
      scope_violations:this.metrics.scopeViolations,
      thrashing:this.metrics.thrashingCount,
      routing_regret:this.metrics.routingRegretCount,
    });
  }

  getTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw hardError("TASK_ID_MISMATCH");
    return task;
  }

  getAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) throw hardError("AGENT_ID_MISMATCH");
    return agent;
  }

  getAssignment(assignmentId) {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) throw hardError("ADMISSION_BLOCK","ASSIGNMENT_NOT_FOUND");
    return assignment;
  }
}

export function hardEvidenceHash({ id, kind, identity, version, timestamp, parent }) {
  return createHash("sha256")
    .update(JSON.stringify({ id, kind, identity, version, timestamp, parent:parent ?? null }), "utf8")
    .digest("hex");
}

export function buildHardControlEvidenceNode({ id, kind, identity, version, timestamp, parent }) {
  const normalized = { id,kind,identity,version,timestamp,parent:parent ?? null };
  return Object.freeze({ ...normalized, hash:hardEvidenceHash(normalized) });
}

export function hardControlTestMatrix() {
  return Object.freeze([
    "task admission","solver/opponent pairing","scope denial","stale SHA","opponent loss","solver loss",
    "red-team handoff","conflict arbitration","memory poisoning","memory conflict","master restart",
    "scheduler restart","promotion protection","wrong agent","wrong task","wrong branch","wrong capability",
    "wrong SHA","expired lease","stale fence token","forbidden tool","budget exceeded","delegation overflow",
    "authority bypass","duplicate wake","partial write","network partition","restart during reconciliation",
    "restart during promotion",
  ]);
}


export function arbitrateHardControlConflict({ riskClass = "MEDIUM", solverOutcome, opponentOutcome }) {
  const solver = String(solverOutcome ?? "UNKNOWN");
  const opponent = String(opponentOutcome ?? "UNKNOWN");
  if (solver === "SUCCESS" && opponent === "PASS") return Object.freeze({ decision:"ACCEPT", closeAllowed:false });
  if (solver === "SUCCESS" && opponent === "COUNTEREXAMPLE") {
    return Object.freeze({
      decision:["HIGH","CRITICAL"].includes(riskClass) ? "ESCALATE" : riskClass === "MEDIUM" ? "REPLAN" : "MORE_EVIDENCE",
      closeAllowed:false,
    });
  }
  if (solver === "FAILURE" || opponent === "FAILURE") return Object.freeze({ decision:"MORE_EVIDENCE", closeAllowed:false });
  return Object.freeze({ decision:"MORE_EVIDENCE", closeAllowed:false });
}

export function authorizeMemoryUse({ sourceSha, currentSha, provenance = [], confidence = 0, trusted = true, conflict = false }) {
  if (sourceSha !== currentSha || !trusted || !Array.isArray(provenance) || provenance.length === 0 || !Number.isFinite(confidence)) {
    return Object.freeze({ allowed:false, code:"D10_TRUTH_MEMORY", reason:"memory is stale, untrusted, unproven, or poisoned" });
  }
  if (conflict) return Object.freeze({ allowed:false, code:"D10_TRUTH_MEMORY", reason:"memory conflict requires independent resolution" });
  return Object.freeze({ allowed:true, code:"ALLOW" });
}

