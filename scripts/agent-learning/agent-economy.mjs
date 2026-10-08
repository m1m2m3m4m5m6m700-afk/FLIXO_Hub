export const ECONOMY_TAX_RATE = 0.10;
export const ECONOMY_SUCCESS_MULTIPLE = 2;
export const ECONOMY_STAKE_RATE = 0.25;
export const ECONOMY_MIN_DIFFICULTY = 1;
export const ECONOMY_MAX_DIFFICULTY = 10;

const SHA_RE = /^[0-9a-f]{40}$/i;

export function assertEconomySha(value, field = 'exactSha') {
  if (!SHA_RE.test(value ?? '')) throw new Error(field + ' must be an exact 40-character git SHA');
  return String(value).toLowerCase();
}

function finiteNumber(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(field + ' must be finite');
  return n;
}

export function quoteEconomyTask({ difficulty, baseReward, openDemand = 0 } = {}) {
  const d = Number(difficulty);
  const base = finiteNumber(baseReward, 'baseReward');
  const demand = finiteNumber(openDemand, 'openDemand');
  if (!Number.isInteger(d) || d < ECONOMY_MIN_DIFFICULTY || d > ECONOMY_MAX_DIFFICULTY) {
    throw new Error('difficulty must be an integer from 1 to 10');
  }
  if (base <= 0) throw new Error('baseReward must be positive');
  if (demand < 0) throw new Error('openDemand must be non-negative');

  const multiplier = (1 + d * 0.20) * (1 + Math.min(2, demand / 10));
  const quotedReward = Math.max(1, Math.ceil(base * multiplier));
  const stakeRequired = Math.max(1, Math.ceil(quotedReward * ECONOMY_STAKE_RATE));
  const tax = Math.floor(quotedReward * ECONOMY_TAX_RATE);
  const successPayout = (ECONOMY_SUCCESS_MULTIPLE * quotedReward) - tax;

  return Object.freeze({
    difficulty: d,
    baseReward: base,
    demandScore: demand,
    multiplier,
    quotedReward,
    stakeRequired,
    tax,
    successPayout,
    knowledgeTaxRate: ECONOMY_TAX_RATE,
    successReturnMultiple: ECONOMY_SUCCESS_MULTIPLE,
  });
}

export function assertIndependentSolverVerifier(solverAgent, verifierAgent) {
  if (!String(solverAgent ?? '').trim() || !String(verifierAgent ?? '').trim()) {
    throw new Error('solver and verifier are required');
  }
  if (String(solverAgent).trim() === String(verifierAgent).trim()) {
    throw new Error('INDEPENDENT_VERIFIER_REQUIRED');
  }
  return true;
}

export function validateEconomySettlement({ taskExactSha, settlementExactSha, solverAgent, verifierAgent, outcome } = {}) {
  const taskSha = assertEconomySha(taskExactSha, 'taskExactSha');
  const settlementSha = assertEconomySha(settlementExactSha, 'settlementExactSha');
  if (taskSha !== settlementSha) throw new Error('ECONOMY_EXACT_SHA_MISMATCH');
  assertIndependentSolverVerifier(solverAgent, verifierAgent);
  const normalizedOutcome = String(outcome ?? '').toUpperCase();
  if (!['SUCCESS', 'FAILURE'].includes(normalizedOutcome)) {
    throw new Error('INVALID_SETTLEMENT_OUTCOME');
  }
  return normalizedOutcome;
}

function getEnv(env = process.env) {
  const baseUrl = String(env.SUPABASE_URL || env.SUPABASE_PROJECT_URL || '').replace(/\/+$/, '');
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl) throw new Error('SUPABASE_URL_REQUIRED');
  if (!secret) throw new Error('SUPABASE_SERVICE_KEY_REQUIRED');
  return { baseUrl, secret };
}

async function parse(response, label) {
  const raw = await response.text();
  let body;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  if (!response.ok) {
    throw new Error(label + '_FAILED:' + response.status + ':' + (typeof body === 'string' ? body : JSON.stringify(body)));
  }
  return body;
}

export function createAgentEconomyClient({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const { baseUrl, secret } = getEnv(env);
  if (typeof fetchImpl !== 'function') throw new Error('FETCH_REQUIRED');
  const headers = {
    apikey: secret,
    ...(String(secret).startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + secret }),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  async function rpc(name, payload) {
    if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('INVALID_RPC_NAME');
    return parse(await fetchImpl(baseUrl + '/rest/v1/rpc/' + name, {
      method: 'POST', headers, body: JSON.stringify(payload),
    }), 'SUPABASE_ECONOMY_RPC');
  }

  return Object.freeze({
    async listWallets({ minReputation = 0, limit = 100 } = {}) {
      const reputation = Number(minReputation);
      const boundedLimit = Math.max(1, Math.min(100, Number(limit)));
      if (!Number.isFinite(reputation) || reputation < 0 || reputation > 100) {
        throw new Error('INVALID_MIN_REPUTATION');
      }
      if (!Number.isInteger(boundedLimit)) throw new Error('INVALID_WALLET_LIMIT');

      const params = new URLSearchParams({
        select: 'agent_id,role,status,balance_credits,staked_credits,reputation,tasks_won,tasks_lost',
        status: 'eq.ACTIVE',
        reputation: 'gte.' + String(reputation),
        order: 'reputation.desc,agent_id.asc',
        limit: String(boundedLimit),
      });
      return parse(await fetchImpl(baseUrl + '/rest/v1/flixo_agent_economy_wallets?' + params.toString(), {
        method: 'GET',
        headers,
      }), 'SUPABASE_ECONOMY_WALLETS');
    },

  return Object.freeze({
    quote({ difficulty, baseReward, openDemand = 0 }) {
      return rpc('flixo_economy_quote_task', {
        p_difficulty: difficulty, p_base_reward: baseReward, p_open_demand: openDemand,
      });
    },
    seedWallet({ agentId, role, initialBalance = 1000 }) {
      return rpc('flixo_economy_seed_wallet', {
        p_agent_id: agentId, p_role: role, p_initial_balance: initialBalance,
      });
    },
    openTask({ taskId, exactSha, difficulty, baseReward, openDemand = 0 }) {
      return rpc('flixo_economy_open_task', {
        p_task_id: taskId, p_exact_sha: assertEconomySha(exactSha),
        p_difficulty: difficulty, p_base_reward: baseReward, p_open_demand: openDemand,
      });
    },
    claimTask({ taskId, agentId, role = 'SOLVER' }) {
      return rpc('flixo_economy_claim_task', {
        p_task_id: taskId, p_agent_id: agentId, p_role: role,
      });
    },
    settleTask({ taskId, solverAgent, verifierAgent, outcome, exactSha, evidenceRefs = [] }) {
      const normalized = validateEconomySettlement({
        taskExactSha: exactSha, settlementExactSha: exactSha,
        solverAgent, verifierAgent, outcome,
      });
      return rpc('flixo_economy_settle_task', {
        p_task_id: taskId, p_verifier_agent: verifierAgent,
        p_outcome: normalized, p_exact_sha: assertEconomySha(exactSha),
        p_evidence_refs: evidenceRefs,
      });
    },
  });
}
