import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_CAPABILITIES,
  auditAgentControlPlane,
  auditExecutionEnvelope,
  loadCanonicalRegistry,
  parseProfileFrontmatter,
  validateProfileContract,
} from '../../../scripts/agent-control-plane.mjs';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();

test('agent control plane source is syntactically valid before lifecycle evaluation', () => {
  execFileSync(process.execPath, ['--check', 'scripts/agent-control-plane.mjs'], { stdio: 'pipe' });
});

test('canonical registry is the only identity authority and contains 10 principals + one support role', () => {
  const registry = loadCanonicalRegistry(ROOT);
  assert.equal(registry.officialAgentCount, 14);
  assert.equal(registry.agents.length, 14);
  assert.deepEqual(registry.agents.map(a => a.id), Array.from({ length: 10 }, (_, i) => 'AGENT-' + String(i + 1).padStart(2, '0')));
  assert.equal(registry.supportingRoles.length, 1);
  assert.equal(registry.supportingRoles[0].id, 'SUPPORT-EXPLORER-02');
});

test('all registered profiles expose the unified machine contract and capability matrix', () => {
  const audit = auditAgentControlPlane(ROOT);
  assert.equal(audit.status, 'PASS', audit.issues.join('; '));
  assert.equal(audit.agents.length, 15);
  assert.equal(audit.agents.filter(a => a.class === 'principal').length, 14);
  assert.equal(audit.agents.find(a => a.id === 'SUPPORT-EXPLORER-02')?.effectiveLifecycle, 'READY-TEST');
  for (const agent of audit.agents) {
    assert.equal(agent.issues.length, 0, agent.id + ': ' + agent.issues.join('; '));
  }
  assert.deepEqual(AGENT_CAPABILITIES.length, 15);
});

test('Scout profiles are inbox-only and cannot expose source-edit authority', () => {
  for (const file of [
    '.github/agents/flixo-scout-architecture.agent.md',
    '.github/agents/flixo-scout-technology.agent.md',
    '.github/agents/flixo-scout-ecosystem.agent.md',
  ]) {
    const p = parseProfileFrontmatter(readFileSync(file, 'utf8'));
    assert.deepEqual(p.tools, ['read', 'search', 'edit']);
    assert.equal(p.write_scope, '.agent-intelligence/inbox/');
    assert.equal(p.cap_WRITE_INBOX, 'ALLOW');
    assert.equal(p.cap_WRITE_REPORTS, 'DENY');
    for (const capability of ['EDIT_SOURCE', 'EDIT_TESTS', 'EDIT_WORKFLOWS', 'EDIT_GOVERNANCE', 'EDIT_TASKS', 'EDIT_AGENT_PROFILES']) {
      assert.equal(p['cap_' + capability], 'DENY', file + ': ' + capability);
    }
  }
});

test('supporting Explorer 2 inherits no authority and is derived-only', () => {
  const registry = loadCanonicalRegistry(ROOT);
  const support = registry.supportingRoles[0];
  const profilePath = support.profile;
  const profile = parseProfileFrontmatter(readFileSync(profilePath, 'utf8'));
  assert.equal(profile.principal, false);
  assert.equal(profile.parent_agent_id, 'AGENT-01');
  assert.equal(profile.authority_inheritance, 'none');
  assert.equal(profile.dispatch_authority, 'derived-only');
  assert.equal(profile.independent_review, true);
  assert.equal(profile.certification_authority, false);
  assert.equal(profile.cap_CERTIFY, 'DENY');
});

test('lifecycle is derived by the validator and cannot be self-promoted to behavioral-observed', () => {
  const registry = loadCanonicalRegistry(ROOT);
  const agent = registry.agents.find(a => a.id === 'AGENT-05');
  const original = parseProfileFrontmatter(readFileSync(agent.profile, 'utf8'));
  const forged = { ...original, lifecycle: 'BEHAVIORAL-OBSERVED' };
  const issues = validateProfileContract(forged, agent, ROOT);
  assert.ok(issues.some(issue => issue.includes('behavioral lifecycle cannot be self-declared')));
});

test('execution envelope is derived from the canonical task ledger without becoming a second dispatch ledger', () => {
  const ledger = auditExecutionEnvelope(ROOT);
  assert.equal(ledger.issues.length, 0, ledger.issues.join('; '));
  assert.ok(ledger.activeTaskCount >= 1);
  for (const envelope of ledger.envelopes) {
    assert.ok(envelope.TASK_ID);
    assert.ok(envelope.MISSION);
    assert.ok(envelope.ACCEPTANCE_CONDITIONS);
    assert.ok(envelope.HANDOFF_CONTRACT);
    assert.ok(['BOUND', 'PENDING_CLAIM'].includes(envelope.bindingStatus));
  }
});

test('declared lifecycle cannot outrun derived lifecycle', async () => {
  const audit = auditAgentControlPlane(ROOT, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  for (const agent of audit.agents) {
    assert.equal(agent.issues.some(issue => /declared lifecycle must equal/u.test(issue)), false, agent.id);
  }
});
