import { awardXp, type CallRankRecord } from "./call-ranks";

export const CALL_XP_INCENTIVES_VERSION = "1.0.0" as const;
const SHA = /^[0-9a-f]{40}$/iu;

export const XP_ACHIEVEMENTS = [
  "SUCCESS",
  "USEFUL_EVIDENCE",
  "VALID_COUNTEREXAMPLE",
  "ROOT_CAUSE",
  "SECURITY_FINDING",
  "REGRESSION_PREVENTION",
  "FAILURE_RECOVERY",
  "COLLABORATION",
  "KNOWLEDGE_TRANSFER",
] as const;
export type XpAchievementType = (typeof XP_ACHIEVEMENTS)[number];

export const XP_BEHAVIORS = [
  "DELIVER_VERIFIED_WORK",
  "REPORT_EVIDENCE",
  "FIND_COUNTEREXAMPLE",
  "IDENTIFY_ROOT_CAUSE",
  "PREVENT_REGRESSION",
  "RECOVER_FROM_FAILURE",
  "HELP_COUNCIL_CONVERGE",
  "TRANSFER_REUSABLE_KNOWLEDGE",
  "DISCLOSE_UNCERTAINTY",
  "HONOR_HANDOFF",
] as const;
export type XpBehavior = (typeof XP_BEHAVIORS)[number];

export const XP_VIOLATIONS = [
  "FALSE_CLAIM",
  "FABRICATED_EVIDENCE",
  "SHA_TAMPERING",
  "POLICY_BYPASS",
  "PREMATURE_CERTIFICATION",
  "HIDDEN_FAILURE",
  "MISREPRESENTED_RESULT",
  "IGNORED_HANDOFF",
  "DUPLICATE_UNDISCLOSED_WORK",
  "XP_GAMING",
] as const;
export type XpViolationType = (typeof XP_VIOLATIONS)[number];

export type XpClaim = Readonly<{
  claimId: string;
  agentId: string;
  taskId: string;
  attempt: number;
  claimedXp: number;
  reason: string;
  achievementType: XpAchievementType;
  behavior: XpBehavior;
  evidenceRefs: readonly string[];
  sourceSha: string;
  resultSummary: string;
  counterEvidenceRefs: readonly string[];
  requestedAt: number;
  policyVersion: string;
}>;

export type XpDecisionStatus = "APPROVED" | "REDUCED" | "REJECTED" | "ESCALATED";

export type XpDecision = Readonly<{
  decisionId: string;
  claimId: string;
  masterAgentId: "master";
  masterModelId: "GLM-5.3";
  status: XpDecisionStatus;
  approvedXp: number;
  reason: string;
  evidenceRefs: readonly string[];
  dispositionRef: string;
  policyVersion: string;
  decidedAt: number;
}>;

export type XpLedgerEntry = Readonly<{
  entryId: string;
  claim: XpClaim;
  decision: XpDecision;
  previousXp: number;
  resultingXp: number;
}>;

export type XpIncentivePolicy = Readonly<{
  reward: Readonly<Record<XpAchievementType, number>>;
  violationPenalty: Readonly<Record<XpViolationType, number>>;
  falseEvidenceMultiplier: number;
  uncertaintyDisclosureBonus: number;
  cleanHandoffBonus: number;
  collaborationBonus: number;
  maxClaimedXpPerClaim: number;
  maxApprovedXpPerClaim: number;
}>;

export const CALL_XP_INCENTIVE_POLICY: XpIncentivePolicy = Object.freeze({
  reward: Object.freeze({
    SUCCESS: 100,
    USEFUL_EVIDENCE: 60,
    VALID_COUNTEREXAMPLE: 90,
    ROOT_CAUSE: 120,
    SECURITY_FINDING: 150,
    REGRESSION_PREVENTION: 120,
    FAILURE_RECOVERY: 90,
    COLLABORATION: 50,
    KNOWLEDGE_TRANSFER: 40,
  }),
  violationPenalty: Object.freeze({
    FALSE_CLAIM: -120,
    FABRICATED_EVIDENCE: -500,
    SHA_TAMPERING: -500,
    POLICY_BYPASS: -350,
    PREMATURE_CERTIFICATION: -250,
    HIDDEN_FAILURE: -200,
    MISREPRESENTED_RESULT: -200,
    IGNORED_HANDOFF: -80,
    DUPLICATE_UNDISCLOSED_WORK: -60,
    XP_GAMING: -150,
  }),
  falseEvidenceMultiplier: 2,
  uncertaintyDisclosureBonus: 20,
  cleanHandoffBonus: 20,
  collaborationBonus: 30,
  maxClaimedXpPerClaim: 250,
  maxApprovedXpPerClaim: 200,
} as const);

function requiredString(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

export function validateXpClaim(claim: XpClaim): void {
  for (const [value, code] of [
    [claim.claimId, "XP_CLAIM_ID_REQUIRED"],
    [claim.agentId, "XP_CLAIM_AGENT_REQUIRED"],
    [claim.taskId, "XP_CLAIM_TASK_REQUIRED"],
    [claim.reason, "XP_CLAIM_REASON_REQUIRED"],
    [claim.resultSummary, "XP_CLAIM_RESULT_REQUIRED"],
    [claim.policyVersion, "XP_CLAIM_POLICY_REQUIRED"],
  ] as const) requiredString(value, code);
  if (!Number.isInteger(claim.attempt) || claim.attempt < 1) throw new Error("XP_CLAIM_ATTEMPT_INVALID");
  if (!Number.isFinite(claim.claimedXp) || claim.claimedXp <= 0 || claim.claimedXp > CALL_XP_INCENTIVE_POLICY.maxClaimedXpPerClaim) {
    throw new Error("XP_CLAIM_AMOUNT_INVALID");
  }
  if (!SHA.test(claim.sourceSha)) throw new Error("XP_CLAIM_SHA_INVALID");
  if (claim.evidenceRefs.length === 0) throw new Error("XP_CLAIM_EVIDENCE_REQUIRED");
  if (claim.evidenceRefs.some((ref) => !ref.trim())) throw new Error("XP_CLAIM_EVIDENCE_INVALID");
}

export function createXpClaim(input: Omit<XpClaim, "policyVersion">, policyVersion: string): XpClaim {
  const claim = Object.freeze({ ...input, policyVersion });
  validateXpClaim(claim);
  return claim;
}

export function decideXpClaim(
  claim: XpClaim,
  input: Readonly<{
    decisionId: string;
    approvedXp: number;
    status: XpDecisionStatus;
    reason: string;
    evidenceRefs: readonly string[];
    dispositionRef: string;
    decidedAt?: number;
  }>,
): XpDecision {
  validateXpClaim(claim);
  if (input.status === "APPROVED" && input.approvedXp !== claim.claimedXp) throw new Error("XP_APPROVAL_MUST_MATCH_CLAIM");
  if (!Number.isFinite(input.approvedXp) || input.approvedXp < 0 || input.approvedXp > claim.claimedXp ||
      input.approvedXp > CALL_XP_INCENTIVE_POLICY.maxApprovedXpPerClaim) {
    throw new Error("XP_DECISION_AMOUNT_INVALID");
  }
  if (input.status !== "REJECTED" && input.evidenceRefs.length === 0) throw new Error("XP_DECISION_EVIDENCE_REQUIRED");
  requiredString(input.reason, "XP_DECISION_REASON_REQUIRED");
  requiredString(input.dispositionRef, "XP_DECISION_DISPOSITION_REQUIRED");
  requiredString(input.decisionId, "XP_DECISION_ID_REQUIRED");
  return Object.freeze({
    decisionId: input.decisionId,
    claimId: claim.claimId,
    masterAgentId: "master",
    masterModelId: "GLM-5.3",
    status: input.status,
    approvedXp: input.approvedXp,
    reason: input.reason,
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    dispositionRef: input.dispositionRef,
    policyVersion: claim.policyVersion,
    decidedAt: input.decidedAt ?? Date.now(),
  });
}

export function applyApprovedXp(
  record: CallRankRecord,
  claim: XpClaim,
  decision: XpDecision,
): CallRankRecord {
  if (decision.claimId !== claim.claimId) throw new Error("XP_LINEAGE_MISMATCH");
  if (decision.masterAgentId !== "master" || decision.masterModelId !== "GLM-5.3") throw new Error("XP_MASTER_INVALID");
  if (decision.policyVersion !== claim.policyVersion) throw new Error("XP_POLICY_MISMATCH");
  if (decision.status !== "APPROVED" && decision.status !== "REDUCED") throw new Error("XP_NOT_AWARDABLE");
  if (decision.approvedXp <= 0) throw new Error("XP_NOT_AWARDABLE");
  if (record.agentId !== claim.agentId) throw new Error("XP_AGENT_MISMATCH");
  return awardXp(record, decision.approvedXp, true, decision.decidedAt);
}

export function createXpLedgerEntry(
  entryId: string,
  claim: XpClaim,
  decision: XpDecision,
  previousXp: number,
  resultingXp: number,
): XpLedgerEntry {
  if (!entryId.trim()) throw new Error("XP_LEDGER_ID_REQUIRED");
  if (decision.claimId !== claim.claimId) throw new Error("XP_LEDGER_LINEAGE_MISMATCH");
  if (resultingXp < previousXp) throw new Error("XP_LEDGER_RESULT_INVALID");
  return Object.freeze({ entryId, claim, decision, previousXp, resultingXp });
}

export function calculateViolationPenalty(
  violation: XpViolationType,
  evidenceBacked: boolean,
): number {
  const base = CALL_XP_INCENTIVE_POLICY.violationPenalty[violation];
  if (violation === "FABRICATED_EVIDENCE" && evidenceBacked) return base * CALL_XP_INCENTIVE_POLICY.falseEvidenceMultiplier;
  return base;
}

export function incentiveScore(
  achievements: readonly XpAchievementType[],
  behaviors: readonly XpBehavior[],
  violations: readonly XpViolationType[],
): number {
  const reward = achievements.reduce((sum, item) => sum + CALL_XP_INCENTIVE_POLICY.reward[item], 0);
  const behaviorBonus = behaviors.includes("DISCLOSE_UNCERTAINTY") ? CALL_XP_INCENTIVE_POLICY.uncertaintyDisclosureBonus : 0;
  const handoffBonus = behaviors.includes("HONOR_HANDOFF") ? CALL_XP_INCENTIVE_POLICY.cleanHandoffBonus : 0;
  const collaborationBonus = behaviors.includes("HELP_COUNCIL_CONVERGE") ? CALL_XP_INCENTIVE_POLICY.collaborationBonus : 0;
  const penalty = violations.reduce((sum, item) => sum + CALL_XP_INCENTIVE_POLICY.violationPenalty[item], 0);
  return reward + behaviorBonus + handoffBonus + collaborationBonus + penalty;
}
