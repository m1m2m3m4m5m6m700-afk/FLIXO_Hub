import { assertEconomySha, createAgentEconomyClient, quoteEconomyTask } from './agent-economy.mjs';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));

function normalizeWallet(wallet) {
  const agentId = String(wallet?.agent_id ?? wallet?.agentId ?? '').trim();
  if (!agentId) throw new Error('ECONOMY_WALLET_AGENT_ID_REQUIRED');
  return Object.freeze({
    agentId,
    role: String(wallet?.role ?? 'AGENT').trim() || 'AGENT',
    status: String(wallet?.status ?? 'ACTIVE').toUpperCase(),
    balanceCredits: Number(wallet?.balance_credits ?? wallet?.balanceCredits ?? 0),
    stakedCredits: Number(wallet?.staked_credits ?? wallet?.stakedCredits ?? 0),
    reputation: clamp(Number(wallet?.reputation ?? 50), 0, 100),
    taskFit: clamp(Number(wallet?.task_fit ?? wallet?.taskFit ?? 0.5)),
    routingScore: clamp(Number(wallet?.routing_score ?? wallet?.routingScore ?? 0.5)),
    independentVerifier: wallet?.independent_verifier ?? wallet?.independentVerifier ?? false,
  });
}

function candidateScore(wallet, stakeRequired) {
  const stakeCapacity = stakeRequired > 0
    ? clamp(wallet.balanceCredits / (stakeRequired * 4))
    : 1;
  return Number((
    (wallet.reputation / 100) * 0.40 +
    wallet.taskFit * 0.30 +
    wallet.routingScore * 0.20 +
    stakeCapacity * 0.10
  ).toFixed(6));
}

export function buildEconomyDispatchPlan({
  taskId,
  exactSha,
  difficulty,
  baseReward,
  openDemand = 0,
  solverAgentId,
  verifierAgentId,
  wallets = [],
} = {}) {
  if (!String(taskId ?? '').trim()) throw new Error('TASK_ID_REQUIRED');
  const sha = assertEconomySha(exactSha, 'exactSha');
  const quote = quoteEconomyTask({ difficulty, baseReward, openDemand });
  const normalized = wallets.map(normalizeWallet);

  const explicitSolverId = String(solverAgentId ?? '').trim();
  const eligibleSolvers = rankEconomySolverCandidates({
    candidates: normalized,
    stakeRequired: quote.stakeRequired,
  });
  const solver = explicitSolverId
    ? normalized.find(wallet => wallet.agentId === explicitSolverId)
    : eligibleSolvers[0];

  if (!solver) throw new Error('ECONOMY_SOLVER_WALLET_NOT_FOUND');
  if (solver.status !== 'ACTIVE') throw new Error('ECONOMY_SOLVER_WALLET_INACTIVE');
  if (solver.balanceCredits < quote.stakeRequired) throw new Error('INSUFFICIENT_STAKE');

  const verifier = normalized.find(wallet => wallet.agentId === String(verifierAgentId ?? '').trim());
  if (!verifier) throw new Error('ECONOMY_VERIFIER_WALLET_NOT_FOUND');
  if (verifier.status !== 'ACTIVE') throw new Error('ECONOMY_VERIFIER_WALLET_INACTIVE');
  if (verifier.agentId === solver.agentId) throw new Error('INDEPENDENT_VERIFIER_REQUIRED');

  const solverScore = candidateScore(solver, quote.stakeRequired);
  return Object.freeze({
    status: 'ELIGIBLE',
    taskId: String(taskId).trim(),
    exactSha: sha,
    quote,
    solver: Object.freeze({ ...solver, score: solverScore }),
    verifier: Object.freeze({ ...verifier, score: candidateScore(verifier, 0) }),
    authority: Object.freeze({
      mutationAuthority: false,
      plannerAuthority: false,
      certificationAuthority: false,
      economicGateOnly: true,
    }),
  });
}

export function rankEconomySolverCandidates({
  candidates = [],
  stakeRequired,
} = {}) {
  if (!Number.isFinite(Number(stakeRequired)) || Number(stakeRequired) <= 0) {
    throw new Error('STAKE_REQUIRED_INVALID');
  }
  const rows = candidates
    .map(normalizeWallet)
    .filter(wallet => wallet.status === 'ACTIVE' && wallet.balanceCredits >= Number(stakeRequired))
    .map(wallet => Object.freeze({ ...wallet, score: candidateScore(wallet, Number(stakeRequired)) }))
    .sort((a, b) => b.score - a.score || a.agentId.localeCompare(b.agentId));
  return Object.freeze(rows);
}

export function createAgentEconomyMatchmaker({ env = process.env, fetchImpl = globalThis.fetch, client } = {}) {
  const economy = client ?? createAgentEconomyClient({ env, fetchImpl });

  return Object.freeze({
    async quote(input) {
      return economy.quote(input);
    },

    async prepare(input) {
      const wallets = await economy.listWallets({ limit: input?.walletLimit ?? 100 });
      return buildEconomyDispatchPlan({ ...input, wallets });
    },

    async openAndClaim(input) {
      const plan = await this.prepare(input);
      const opened = await economy.openTask({
        taskId: plan.taskId,
        exactSha: plan.exactSha,
        difficulty: plan.quote.difficulty,
        baseReward: plan.quote.baseReward,
        openDemand: plan.quote.demandScore,
      });
      const claimed = await economy.claimTask({
        taskId: plan.taskId,
        agentId: plan.solver.agentId,
        role: 'SOLVER',
      });
      return Object.freeze({ plan, opened, claimed });
    },

    async settle({ taskId, verifierAgent, outcome, exactSha, evidenceRefs = [] } = {}) {
      return economy.settleTask({
        taskId,
        solverAgent: null,
        verifierAgent,
        outcome,
        exactSha,
        evidenceRefs,
      });
    },
  });
}
