export const CALL_RANKS_VERSION = "1.0.0" as const;

export const CALL_RANKS = [
  "INITIATE",
  "OPERATOR",
  "SPECIALIST",
  "SENIOR",
  "COUNCIL",
  "SOVEREIGN",
] as const;
export type CallRank = (typeof CALL_RANKS)[number];

export type CallRankRecord = Readonly<{
  agentId: string;
  xp: number;
  rank: CallRank;
  successfulRuns: number;
  failedRuns: number;
  usefulEvidence: number;
  validCounterexamples: number;
  updatedAt: number;
}>;

export type CallEscalationState = Readonly<{
  taskId: string;
  attempt: number;
  currentAgentId: string;
  invitedAgentIds: readonly string[];
  councilSize: number;
  reason: "FIRST_ATTEMPT" | "AGENT_FAILED" | "REPEATED_FAILURE" | "CONFLICT" | "CRITICAL";
}>;

export type CallRoutingDecision = Readonly<{
  taskId: string;
  selectedAgentId: string;
  selectedRank: CallRank;
  attempt: number;
  council: boolean;
  participants: readonly string[];
}>;

const RANK_THRESHOLDS: Record<CallRank, number> = {
  INITIATE: 0,
  OPERATOR: 100,
  SPECIALIST: 300,
  SENIOR: 700,
  COUNCIL: 1500,
  SOVEREIGN: 3000,
};

const COUNCIL_SIZE_BY_ATTEMPT = [1, 2, 3, 4, 5] as const;

export function rankForXp(xp: number): CallRank {
  if (!Number.isFinite(xp) || xp < 0) throw new Error("RANK_XP_INVALID");
  let selected: CallRank = "INITIATE";
  for (const rank of CALL_RANKS) if (xp >= RANK_THRESHOLDS[rank]) selected = rank;
  return selected;
}

export function createRankRecord(agentId: string, now = Date.now()): CallRankRecord {
  if (!agentId.trim()) throw new Error("RANK_AGENT_REQUIRED");
  return Object.freeze({
    agentId, xp: 0, rank: "INITIATE", successfulRuns: 0, failedRuns: 0,
    usefulEvidence: 0, validCounterexamples: 0, updatedAt: now,
  });
}

export function awardXp(
  record: CallRankRecord,
  delta: number,
  evidenceBacked: boolean,
  now = Date.now(),
): CallRankRecord {
  if (!evidenceBacked) throw new Error("XP_EVIDENCE_REQUIRED");
  if (!Number.isFinite(delta) || delta <= 0) throw new Error("XP_DELTA_INVALID");
  const xp = record.xp + delta;
  return Object.freeze({ ...record, xp, rank: rankForXp(xp), updatedAt: now });
}

export function recordAgentOutcome(
  record: CallRankRecord,
  outcome: "SUCCESS" | "USEFUL_EVIDENCE" | "VALID_COUNTEREXAMPLE" | "FAILURE",
  xp: number,
  evidenceBacked: boolean,
  now = Date.now(),
): CallRankRecord {
  const next = outcome === "FAILURE"
    ? { ...record, failedRuns: record.failedRuns + 1, updatedAt: now }
    : {
        ...awardXp(record, xp, evidenceBacked, now),
        successfulRuns: record.successfulRuns + (outcome === "SUCCESS" ? 1 : 0),
        usefulEvidence: record.usefulEvidence + (outcome === "USEFUL_EVIDENCE" ? 1 : 0),
        validCounterexamples: record.validCounterexamples + (outcome === "VALID_COUNTEREXAMPLE" ? 1 : 0),
      };
  return Object.freeze(next);
}

export function nextCouncilSize(attempt: number): number {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("ATTEMPT_INVALID");
  return COUNCIL_SIZE_BY_ATTEMPT[Math.min(attempt - 1, COUNCIL_SIZE_BY_ATTEMPT.length - 1)];
}

export function createEscalation(
  taskId: string,
  attempt: number,
  currentAgentId: string,
  availableAgentIds: readonly string[],
  reason: CallEscalationState["reason"],
): CallEscalationState {
  if (!taskId.trim() || !currentAgentId.trim()) throw new Error("ESCALATION_ID_REQUIRED");
  const councilSize = nextCouncilSize(attempt);
  const ordered = [...new Set(availableAgentIds.filter((id) => id.trim() && id !== currentAgentId))];
  const participants = [currentAgentId, ...ordered].slice(0, councilSize);
  return Object.freeze({
    taskId, attempt, currentAgentId,
    invitedAgentIds: Object.freeze(participants.slice(1)),
    councilSize: participants.length,
    reason,
  });
}

export function routeAfterFailure(
  taskId: string,
  failedAgentId: string,
  attempt: number,
  rankedAgents: readonly CallRankRecord[],
): CallRoutingDecision {
  if (!taskId.trim() || !failedAgentId.trim()) throw new Error("ROUTING_ID_REQUIRED");
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("ATTEMPT_INVALID");
  const candidates = rankedAgents
    .filter((a) => a.agentId !== failedAgentId)
    .sort((a, b) => b.xp - a.xp || a.agentId.localeCompare(b.agentId));
  if (candidates.length === 0) throw new Error("NO_NEXT_RANK_AGENT");
  const council = attempt >= 2;
  const size = council ? Math.min(nextCouncilSize(attempt), candidates.length + 1) : 1;
  const participants = council
    ? [failedAgentId, ...candidates.map((a) => a.agentId)].slice(0, size)
    : [candidates[0].agentId];
  const selected = candidates[0];
  return Object.freeze({
    taskId, selectedAgentId: selected.agentId, selectedRank: selected.rank,
    attempt, council, participants: Object.freeze(participants),
  });
}

export function electSovereign(records: readonly CallRankRecord[]): CallRankRecord {
  if (records.length === 0) throw new Error("NO_AGENTS_FOR_SOVEREIGN");
  const eligible = records.filter((r) => r.xp >= RANK_THRESHOLDS.SOVEREIGN);
  if (eligible.length === 0) throw new Error("NO_SOVEREIGN_ELIGIBLE");
  return [...eligible].sort((a, b) => b.xp - a.xp || b.successfulRuns - a.successfulRuns || a.agentId.localeCompare(b.agentId))[0];
}

export function assertSovereignScope(role: "EXECUTION" | "POLICY" | "CERTIFICATION" | "GOVERNANCE"): void {
  if (role !== "EXECUTION") throw new Error("SOVEREIGN_CANNOT_OVERRIDE_GOVERNANCE");
}
