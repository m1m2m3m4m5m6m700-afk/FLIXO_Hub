import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(path, 'utf8');

test('RT-01 privileged wake RPC has explicit deny-by-default EXECUTE policy', async () => {
  const sql = await read('supabase/migrations/20261006143000_redteam_rt01_privileged_rpc_lockdown.sql');
  for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
    assert.match(sql, new RegExp('revoke execute on function public\\.flixo_retry_pending_assistant_wakes\\(\\) from ' + role + ';'));
  }
  assert.match(sql, /select username[\\s\\S]*from cron\\.job[\\s\\S]*where jobname = 'flixo-assistant-wake-retry'/u);
  assert.match(sql, /grant execute on function public\\.flixo_retry_pending_assistant_wakes\\(\\) to %I/u);
});

test('RT-10 limiter is server-side, atomic, bounded, and fail-closed', async () => {
  const sql = await read('supabase/migrations/20261006143200_redteam_rt10_distributed_login_rate_limit.sql');
  assert.match(sql, /create table if not exists public\\.flix_admin_login_rate_limits/u);
  assert.match(sql, /on conflict \\(key_hash\\) do update/u);
  assert.match(sql, /least\\(public\\.flix_admin_login_rate_limits\\.attempts \\+ 1, 11\\)/u);
  assert.match(sql, /count\\(\\*\\) from public\\.flix_admin_login_rate_limits\\) >= 50000/u);
  assert.match(sql, /revoke all on table public\\.flix_admin_login_rate_limits from public;/u);
  assert.match(sql, /revoke execute on function public\\.flixo_admin_login_rate_check\\(text\\) from public;/u);
  assert.match(sql, /grant execute on function public\\.flixo_admin_login_rate_check\\(text\\) to service_role;/u);
});

test('RT-18 schema and application contract bind generated identity/time fields', async () => {
  const migration = await read('supabase/migrations/20261006143100_redteam_rt18_integrity_hardening.sql');
  const persistence = await read('src/server/admin/persistence.ts');
  assert.match(migration, /foreign key \\(evidence_id\\)[\\s\\S]*references public\\.flix_admin_evidence\\(evidence_id\\)/u);
  assert.match(persistence, /evidence_id: evidence\\.evidence_id/u);
  assert.match(persistence, /recorded_at: canonicalTimestamp\\(evidence\\.recorded_at\\)/u);
  assert.match(persistence, /created_at: canonicalTimestamp\\(evidence\\.created_at\\)/u);
  assert.match(persistence, /event_id: audit\\.event_id/u);
  assert.match(persistence, /occurred_at: canonicalTimestamp\\(audit\\.occurred_at\\)/u);
  assert.match(persistence, /created_at: canonicalTimestamp\\(audit\\.created_at\\)/u);
});

test('RT-02 Edge source is self-contained under supabase/functions and uses the shared contract', async () => {
  const source = await read('supabase/functions/flixo-council-runtime/index.ts');
  const helper = await read('supabase/functions/_shared/council-oidc.ts');
  const config = await read('supabase/config.toml');
  assert.match(source, /from "\\.\\/_shared\\/council-oidc\\.ts";/u);
  assert.match(source, /GITHUB_OIDC_ISSUER = "https:\\/\\/token\\.actions\\.githubusercontent\\.com"/u);
  assert.match(source, /jwtVerify\\(token, GITHUB_OIDC_JWKS, \\{/u);
  assert.match(helper, /COUNCIL_GITHUB_OIDC_REPOSITORY_REJECTED/u);
  assert.match(helper, /COUNCIL_GITHUB_OIDC_WORKFLOW_REJECTED/u);
  assert.match(helper, /COUNCIL_GITHUB_OIDC_WORKFLOW_SHA_REJECTED/u);
  assert.match(helper, /COUNCIL_GITHUB_OIDC_JOB_WORKFLOW_SHA_REJECTED/u);
  assert.match(config, /\\[functions\\.flixo-council-runtime\\][\\s\\S]*verify_jwt = false/u);
});
