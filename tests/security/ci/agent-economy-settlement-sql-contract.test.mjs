import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const path = 'supabase/migrations/20261008173000_agent_memory_economy_settlement_integrity_v2.sql';
const sql = readFileSync(path, 'utf8');

test('economy settlement rejects unknown or inactive verifiers', () => {
  assert.match(sql, /ECONOMY_VERIFIER_WALLET_NOT_FOUND/u);
  assert.match(sql, /ECONOMY_VERIFIER_WALLET_INACTIVE/u);
  assert.match(sql, /where agent_id = trim\(p_verifier_agent\)/u);
});

test('economy reward ledger records the actual post-settlement balance', () => {
  assert.match(
    sql,
    /case when upper\(trim\(p_outcome\)\) = 'SUCCESS' then v_before \+ v_total else v_before end/u,
  );
});

test('settlement integrity remains exact-SHA and service-role-only', () => {
  assert.match(sql, /ECONOMY_EXACT_SHA_MISMATCH/u);
  assert.match(sql, /revoke all on function public\.flixo_economy_settle_task/u);
  assert.match(sql, /grant execute on function public\.flixo_economy_settle_task[^;]+to service_role/u);
});
