#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

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
    } catch {}
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

function validateCapabilityContract(profile, id, issues) {
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
    if (profile.write_scope !== '.agent-intelligence/inbox/' || profile.cap_WRITE_INBOX !== 'ALLOW') {
      issues.push(id + ': Scout write boundary must be inbox-only');
    }
    if (profile.cap_WRITE_REPORTS !== 'DENY') issues.push(id + ': Scout WRITE_REPORTS must be DENY');
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
  validateCapabilityContract(profile, id, issues);

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
