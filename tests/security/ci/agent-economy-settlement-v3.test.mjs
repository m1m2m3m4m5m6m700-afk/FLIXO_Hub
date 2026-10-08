import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const path = 'supabase/migrations/20261008174500_agent_memory_economy_settlement_integrity_v3.sql';
const sql = readFileSync(path, 'utf8');

test('successful reward ledger records pre-settlement balance as post balance minus total payout', () => {
  assert.match(
    sql,
    /case when upper\(trim\(p_outcome\)\) = 'SUCCESS' then v_after_balance - v_total else v_after_balance end/u,
  );
  assert.match(sql, /balance_after,\s*\n\s*v_after_balance,/u);
});

test('failed settlement preserves the unchanged wallet balance in both ledger endpoints', () => {
  assert.match(
    sql,
    /case when upper\(trim\(p_outcome\)\) = 'SUCCESS' then v_after_balance - v_total else v_after_balance end,/u,
  );
  assert.match(sql, /v_after_balance,\s*\n\s*v_task\.exact_sha,/u);
});

test('v3 preserves independent active verifier and exact-SHA guards', () => {
  assert.match(sql, /ECONOMY_VERIFIER_WALLET_NOT_FOUND/u);
  assert.match(sql, /ECONOMY_VERIFIER_WALLET_INACTIVE/u);
  assert.match(sql, /INDEPENDENT_VERIFIER_REQUIRED/u);
  assert.match(sql, /ECONOMY_EXACT_SHA_MISMATCH/u);
});
