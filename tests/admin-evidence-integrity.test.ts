import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertIntegrityHash,
  integritySha256,
} from '../src/server/admin/canonical.ts';
import {
  assertAdminEvidenceRoundTrip,
  createAuditEvent,
  createEvidence,
  getAuditEvent,
  getEvidence,
  type AdminAuditInput,
  type AdminEvidenceInput,
} from '../src/server/admin/persistence.ts';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

const resetEnvironment = () => {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
};

test.afterEach(resetEnvironment);

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const evidenceInput: AdminEvidenceInput = {
  assertion_id: 'RT-18',
  claim_id: 'evidence-integrity',
  exact_sha: '0123456789abcdef0123456789abcdef01234567',
  source: 'agent-1',
  evaluator: 'red-team',
  environment: 'test',
  status: 'VERIFIED',
  freshness_at: '2026-10-06T14:00:00.000Z',
  payload: { nested: { value: 'original' } },
  expires_at: '2026-10-06T15:00:00.000Z',
};

const auditInput: AdminAuditInput = {
  actor_subject: 'agent-1',
  actor_role: 'OWNER',
  action: 'RED_TEAM_VERIFY',
  capability: 'evidence',
  target_type: 'evidence',
  target_id: '00000000-0000-0000-0000-000000000001',
  exact_sha: evidenceInput.exact_sha,
  environment: 'test',
  outcome: 'SUCCESS',
  correlation_id: 'corr-rt18',
  evidence_id: '00000000-0000-0000-0000-000000000001',
  metadata: { source: 'test' },
};

const configure = () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-service-role-key';
};

test('createEvidence binds generated id/timestamps into integrity payload', async () => {
  configure();
  let sent: Record<string, unknown> | null = null;
  globalThis.fetch = async (_input, init) => {
    sent = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    return jsonResponse([sent]);
  };

  const evidence = await createEvidence(evidenceInput);
  assert.ok(sent);
  assert.match(String(sent.evidence_id), /^[0-9a-f-]{36}$/i);
  assert.match(String(sent.recorded_at), /Z$/);
  assert.match(String(sent.created_at), /Z$/);
  assert.equal(evidence.evidence_id, sent.evidence_id);
  assert.equal(evidence.recorded_at, sent.recorded_at);
  assert.equal(evidence.created_at, sent.created_at);
  assert.equal(
    sent.integrity_sha256,
    integritySha256(sent),
  );
});

test('createEvidence tolerates equivalent database timestamp serialization', async () => {
  configure();
  globalThis.fetch = async (_input, init) => {
    const sent = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    const roundTrip = {
      ...sent,
      recorded_at: String(sent.recorded_at).replace('Z', '+00:00'),
      created_at: String(sent.created_at).replace('Z', '+00:00'),
    };
    return jsonResponse([roundTrip]);
  };

  const evidence = await createEvidence(evidenceInput);
  assert.equal(evidence.evidence_id.length, 36);
  assert.equal(new Date(evidence.recorded_at).toISOString(), evidenceInput.freshness_at.replace('14:00', '16:00'));
});

test('createAuditEvent binds generated id/timestamps into integrity payload', async () => {
  configure();
  let sent: Record<string, unknown> | null = null;
  globalThis.fetch = async (_input, init) => {
    sent = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    return jsonResponse([sent]);
  };

  const audit = await createAuditEvent(auditInput);
  assert.ok(sent);
  assert.match(String(sent.event_id), /^[0-9a-f-]{36}$/i);
  assert.match(String(sent.occurred_at), /Z$/);
  assert.match(String(sent.created_at), /Z$/);
  assert.equal(audit.event_id, sent.event_id);
  assert.equal(audit.occurred_at, sent.occurred_at);
  assert.equal(audit.created_at, sent.created_at);
  assert.equal(sent.integrity_sha256, integritySha256(sent));
});

test('createAuditEvent tolerates equivalent database timestamp serialization', async () => {
  configure();
  globalThis.fetch = async (_input, init) => {
    const sent = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    const roundTrip = {
      ...sent,
      occurred_at: String(sent.occurred_at).replace('Z', '+00:00'),
      created_at: String(sent.created_at).replace('Z', '+00:00'),
    };
    return jsonResponse([roundTrip]);
  };

  const audit = await createAuditEvent(auditInput);
  assert.equal(audit.event_id.length, 36);
});

test('getEvidence rejects tampered identifier, timestamp, or payload', async () => {
  configure();
  const id = '00000000-0000-0000-0000-000000000001';
  const base = {
    ...evidenceInput,
    evidence_id: id,
    recorded_at: '2026-10-06T14:00:00.000Z',
    created_at: '2026-10-06T14:00:00.000Z',
  };
  const integrity = integritySha256(base);
  for (const tampered of [
    { ...base, evidence_id: '00000000-0000-0000-0000-000000000002', integrity_sha256: integrity },
    { ...base, recorded_at: '2026-10-06T14:01:00.000Z', integrity_sha256: integrity },
    { ...base, payload: { nested: { value: 'tampered' } }, integrity_sha256: integrity },
  ]) {
    globalThis.fetch = async () => jsonResponse([{ ...tampered, integrity_sha256: integrity }]);
    await assert.rejects(
      () => getEvidence(id),
      /supabase_evidence_integrity_failed|supabase_evidence_identity_mismatch/,
    );
  }
});

test('getAuditEvent rejects tampered identifier, timestamp, or metadata', async () => {
  configure();
  const id = '00000000-0000-0000-0000-000000000003';
  const base = {
    ...auditInput,
    event_id: id,
    occurred_at: '2026-10-06T14:00:00.000Z',
    created_at: '2026-10-06T14:00:00.000Z',
  };
  const integrity = integritySha256(base);
  for (const tampered of [
    { ...base, event_id: '00000000-0000-0000-0000-000000000004', integrity_sha256: integrity },
    { ...base, occurred_at: '2026-10-06T14:01:00.000Z', integrity_sha256: integrity },
    { ...base, metadata: { source: 'tampered' }, integrity_sha256: integrity },
  ]) {
    globalThis.fetch = async () => jsonResponse([{ ...tampered, integrity_sha256: integrity }]);
    await assert.rejects(
      () => getAuditEvent(id),
      /supabase_audit_integrity_failed|supabase_audit_identity_mismatch/,
    );
  }
});

test('round-trip rejects mismatched evidence/audit links', async () => {
  configure();
  let evidence: Record<string, unknown> | null = null;
  let audit: Record<string, unknown> | null = null;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = String(init?.method ?? 'GET');
    if (method === 'POST' && url.endsWith('/rest/v1/flix_admin_evidence')) {
      evidence = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      return jsonResponse([evidence]);
    }
    if (method === 'POST' && url.endsWith('/rest/v1/flix_admin_audit_events')) {
      audit = {
        ...JSON.parse(String(init?.body ?? '{}')),
        evidence_id: '00000000-0000-0000-0000-000000000999',
      };
      return jsonResponse([audit]);
    }
    if (url.includes('/rest/v1/flix_admin_evidence?evidence_id=')) return jsonResponse([evidence]);
    if (url.includes('/rest/v1/flix_admin_audit_events?event_id=')) return jsonResponse([audit]);
    throw new Error('unexpected_fetch');
  };

  await assert.rejects(
    () => assertAdminEvidenceRoundTrip(evidenceInput, auditInput),
    /supabase_audit_evidence_link_failed|supabase_audit_integrity_failed/,
  );
});

test('assertIntegrityHash remains fail-closed for malformed or changed hashes', () => {
  const value = { value: 'ok' };
  assert.throws(() => assertIntegrityHash('', value, 'FAIL'));
  assert.throws(() => assertIntegrityHash(integritySha256({ value: 'changed' }), value, 'FAIL'));
});
