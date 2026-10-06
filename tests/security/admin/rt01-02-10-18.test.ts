import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { integritySha256, assertIntegrityHash } from '../../../src/server/admin/canonical.ts';
import { consumeAdminLoginRateLimit, resetAdminLoginRateLimit } from '../../../src/server/admin/login-rate-limit.ts';

const read = (path: string) => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20261006180000_agent1_rt01_02_10_18_closure.sql');

test('RT-01: privileged council SECURITY DEFINER functions use an explicit service-role execution boundary', () => {
  const required = [
    'enforce_council_dispatch_priority()', 'flixo_council_assistant_wake_notify()', 'flixo_retry_pending_assistant_wakes()',
    'flixo_claim_due_agent_schedules(integer, timestamptz)', 'council_recover_expired_dispatches(integer)', 'flixo_auto_wake_stale_master3()',
    'council_claim_dispatch(text)', 'council_ack_dispatch(uuid, text, text, text)', 'council_heartbeat_dispatch(uuid, text, text, text)',
    'council_complete_dispatch(uuid, text, text, text, text, jsonb, jsonb)', 'council_claim_assistant_wake(text, text, text)',
    'council_dispatch_assistant_wake(uuid, text)',
  ];
  for (const signature of required) {
    assert.ok(migration.includes('revoke execute on function public.' + signature + ' from public, anon, authenticated;'), signature);
    assert.ok(migration.includes('grant execute on function public.' + signature + ' to service_role;'), signature);
  }
  assert.match(migration, /alter function public\.flixo_retry_pending_assistant_wakes\(\) set search_path = pg_catalog, public, pg_temp/u);
  assert.match(migration, /revoke execute on function net\.http_post\(text, jsonb, jsonb, jsonb, integer\) from public, anon, authenticated;/u);
  assert.match(migration, /revoke execute on function net\.http_get\(text, jsonb, jsonb, integer\) from public, anon, authenticated;/u);
});

test('RT-02: flixo-council-runtime authentication and session binding remain source-controlled and fail-closed', () => {
  const runtime = read('supabase/functions/flixo-council-runtime/index.ts'); const config = read('supabase/config.toml');
  assert.match(config, /verify_jwt\s*=\s*false/u); assert.match(runtime, /createRemoteJWKSet\(/u); assert.match(runtime, /jwtVerify\(token, GITHUB_OIDC_JWKS/u);
  assert.match(runtime, /String\(claims\.repository \?\? ""\) !== GITHUB_REPOSITORY/u); assert.match(runtime, /COUNCIL_TRUSTED_WORKFLOW_SHA_MISSING/u);
  assert.match(runtime, /COUNCIL_SESSION_ID_MISMATCH/u); assert.match(runtime, /COUNCIL_ACTIVATION_SESSION_ID_FORBIDDEN/u);
  assert.match(migration, /current_session_id=p_session_id/u); assert.match(migration, /d\.session_id=p_session_id/u);
});

test('RT-10: Admin login has no process-local limiter and uses the shared RPC boundary', () => {
  const session = read('api/admin/session.ts'); assert.doesNotMatch(session, /loginBuckets|new Map<string, \{ attempts:/u);
  assert.match(session, /consumeAdminLoginRateLimit/u); assert.match(session, /resetAdminLoginRateLimit/u);
  assert.match(migration, /on conflict \(bucket_key\) do update/u); assert.match(migration, /flix_admin_login_rate_limit_consume/u);
  assert.match(migration, /revoke all on table public\.flix_admin_login_rate_limits from public, anon, authenticated, service_role;/u);
});

test('RT-10: limiter uses a one-way bucket key and fails closed on shared-store failure', async () => {
  const oldFetch = globalThis.fetch; const oldUrl = process.env.SUPABASE_URL; const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    process.env.SUPABASE_URL='https://example.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY='server-test-key'; let lastBody='';
    globalThis.fetch=async (_input,init)=>{ lastBody=String(init?.body??''); return new Response(JSON.stringify({allowed:true,attempts:1,resetAt:new Date(Date.now()+60000).toISOString()}),{status:200}); };
    const result=await consumeAdminLoginRateLimit('203.0.113.42',10,60); assert.equal(result.allowed,true); assert.doesNotMatch(lastBody,/203\.0\.113\.42/u);
    globalThis.fetch=async()=>new Response('',{status:503}); await assert.rejects(()=>resetAdminLoginRateLimit('203.0.113.42'),/request_failed/u);
  } finally {
    globalThis.fetch=oldFetch; if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl; if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;
  }
});

test('RT-18: generated evidence/audit identity metadata is integrity-bound', () => {
  const evidence={evidence_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',assertion_id:'RT-18',claim_id:null,exact_sha:'a'.repeat(40),source:'test',evaluator:'agent-1',environment:'test',status:'VERIFIED',freshness_at:'2026-10-06T17:00:00.000Z',recorded_at:'2026-10-06T17:00:01.000Z',payload:{mutation:'none'},expires_at:null,created_at:'2026-10-06T17:00:01.000Z'};
  const audit={event_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',actor_subject:'agent-1',actor_role:'RELEASE',action:'VERIFY',capability:'EVIDENCE',target_type:'branch',target_id:'execution',exact_sha:'a'.repeat(40),environment:'test',outcome:'SUCCESS',correlation_id:null,evidence_id:evidence.evidence_id,occurred_at:'2026-10-06T17:00:02.000Z',metadata:{},created_at:'2026-10-06T17:00:02.000Z'};
  const evidenceDigest=integritySha256(evidence); assert.notEqual(evidenceDigest,integritySha256({...evidence,evidence_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}));
  const auditDigest=integritySha256(audit); assert.notEqual(auditDigest,integritySha256({...audit,event_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}));
  assertIntegrityHash(evidenceDigest,evidence,'evidence-tamper'); assert.throws(()=>assertIntegrityHash(evidenceDigest,{...evidence,recorded_at:'2026-10-06T17:01:01.000Z'},'evidence-tamper'),/evidence-tamper/u);
  assert.match(migration,/before insert or update on public\.flix_admin_evidence/u); assert.match(migration,/before insert or update on public\.flix_admin_audit_events/u);
});

test('RT-18: persistence verifies the database-returned complete record', () => {
  const persistence=read('src/server/admin/persistence.ts');
  assert.match(persistence,/assertIntegrity\(evidence\.integrity_sha256, evidenceIntegrityPayload\(evidence\)/u); assert.match(persistence,/assertIntegrity\(audit\.integrity_sha256, auditIntegrityPayload\(audit\)/u);
  assert.match(persistence,/evidence_id: evidence\.evidence_id/u); assert.match(persistence,/recorded_at: canonicalTimestamp\(evidence\.recorded_at\)/u);
  assert.match(persistence,/event_id: audit\.event_id/u); assert.match(persistence,/occurred_at: canonicalTimestamp\(audit\.occurred_at\)/u);
});
