export const COGNITIVE_CONTRACT_VERSION = "1.0.0" as const;

export const COGNITIVE_EVENT_TYPES = [
  "OBSERVATION",
  "HYPOTHESIS",
  "RESULT",
  "EVIDENCE",
  "COUNTEREXAMPLE",
  "LESSON",
  "INVALIDATION",
  "DECISION",
] as const;
export type CognitiveEventType = (typeof COGNITIVE_EVENT_TYPES)[number];

export const KNOWLEDGE_STATUSES = [
  "UNTRUSTED",
  "PROVISIONAL",
  "VALIDATED",
  "PROMOTED",
  "DISPUTED",
  "STALE",
  "REVOKED",
  "SUPERSEDED",
] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export const KNOWLEDGE_STAGES = ["RAW", "PROVISIONAL", "CHALLENGED", "VALIDATED", "PROMOTED"] as const;
export type KnowledgeStage = (typeof KNOWLEDGE_STAGES)[number];

export const CLAIM_RELATIONS = ["SUPPORT", "OPPOSE", "EVIDENCE"] as const;
export type ClaimRelation = (typeof CLAIM_RELATIONS)[number];

export const REPUTATION_DIMENSIONS = [
  "Security",
  "Coding",
  "Research",
  "Falsification",
  "Verification",
  "Performance",
  "Recovery",
] as const;
export type ReputationDimension = (typeof REPUTATION_DIMENSIONS)[number];

export const XP_REWARD_REASONS = [
  "VERIFIED_IMPROVEMENT",
  "BUG_DISCOVERY",
  "COUNTEREXAMPLE",
  "USEFUL_EVIDENCE",
  "SUCCESSFUL_RECOVERY",
  "REUSABLE_LEARNING",
  "VALIDATED_STRATEGY_IMPROVEMENT",
] as const;
export type XpRewardReason = (typeof XP_REWARD_REASONS)[number];

export const MASTERY_LEVELS = ["NOVICE", "PRACTICED", "VERIFIED", "SPECIALIST", "EXPERT", "MASTER"] as const;
export type MasteryLevel = (typeof MASTERY_LEVELS)[number];

export type CognitiveEvent = Readonly<{
  eventId: string;
  missionId: string;
  taskId: string;
  agentId: string;
  sequence: number;
  epoch: number;
  eventType: CognitiveEventType;
  causationId: string | null;
  correlationId: string;
  sourceSha: string;
  payloadHash: string;
  confidence: number;
  knowledgeStatus: KnowledgeStatus;
  createdAt: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export type CognitiveEpochState = Readonly<{
  currentEpoch: number;
  agentLastSeenEpoch: Readonly<Record<string, number>>;
  knowledgeVersion: number;
  worldModelVersion: number;
}>;

export type KnowledgeRecord = Readonly<{
  knowledgeId: string;
  claim: string;
  stage: KnowledgeStage;
  status: KnowledgeStatus;
  sourceSha: string;
  confidence: number;
  evidenceIds: readonly string[];
  independentConfirmations: number;
  usefulCount: number;
  harmfulCount: number;
  regressionPassed: boolean;
  updatedAt: string;
  supersedes: string | null;
}>;

export type ClaimNode = Readonly<{
  claimId: string;
  statement: string;
  agentId: string;
  status: KnowledgeStatus;
  confidence: number;
  unresolvedQuestions: readonly string[];
}>;

export type ClaimEdge = Readonly<{
  edgeId: string;
  claimId: string;
  relation: ClaimRelation;
  agentId: string;
  targetId: string;
  confidence: number;
  evidenceIds: readonly string[];
}>;

export type AgentReputation = Readonly<{
  agentId: string;
  xp: number;
  reputation: Readonly<Record<ReputationDimension, number>>;
  currentForm: number;
  mastery: Readonly<Record<ReputationDimension, MasteryLevel>>;
  authority: string | null;
  updatedAt: string;
}>;

export type RoutingOutcome = Readonly<{
  taskClass: string;
  agentId: string;
  outcomeId: string;
  exploration: boolean;
  assignmentSuccess: boolean;
  taskClassFit: number;
  cost: number;
  recoveryRate: number;
  routingRegret: number;
  selfSelected: boolean;
  verified: boolean;
  createdAt: string;
}>;

export type RoutingStats = Readonly<{
  agentId: string;
  taskClass: string;
  samples: number;
  assignmentSuccess: number;
  taskClassFit: number;
  cost: number;
  recoveryRate: number;
  routingRegret: number;
  explorationRate: number;
  selfSelectionBiasProtected: boolean;
  selfSelectedSamples: number;
}>;

const EVENT_FIELD_SET = new Set([
  "eventId",
  "missionId",
  "taskId",
  "agentId",
  "sequence",
  "epoch",
  "eventType",
  "causationId",
  "correlationId",
  "sourceSha",
  "payloadHash",
  "confidence",
  "knowledgeStatus",
  "createdAt",
]);

export function validateCognitiveEventContract(event: Partial<CognitiveEvent>): string[] {
  const failures: string[] = [];
  for (const field of EVENT_FIELD_SET) {
    if (!(field in event)) failures.push(`missing:${field}`);
  }
  if (typeof event.eventId !== "string" || event.eventId.trim() === "") failures.push("eventId:required");
  if (typeof event.missionId !== "string" || event.missionId.trim() === "") failures.push("missionId:required");
  if (typeof event.taskId !== "string" || event.taskId.trim() === "") failures.push("taskId:required");
  if (typeof event.agentId !== "string" || event.agentId.trim() === "") failures.push("agentId:required");
  if (!Number.isInteger(event.sequence) || (event.sequence ?? 0) < 1) failures.push("sequence:invalid");
  if (!Number.isInteger(event.epoch) || (event.epoch ?? -1) < 0) failures.push("epoch:invalid");
  if (!COGNITIVE_EVENT_TYPES.includes(event.eventType as CognitiveEventType)) failures.push("eventType:invalid");
  if (typeof event.sourceSha !== "string" || !/^[0-9a-f]{40}$/i.test(event.sourceSha)) failures.push("sourceSha:invalid");
  if (typeof event.payloadHash !== "string" || !/^[0-9a-f]{64}$/i.test(event.payloadHash)) failures.push("payloadHash:invalid");
  if (!Number.isFinite(event.confidence) || (event.confidence ?? -1) < 0 || (event.confidence ?? 2) > 1) failures.push("confidence:invalid");
  if (!KNOWLEDGE_STATUSES.includes(event.knowledgeStatus as KnowledgeStatus)) failures.push("knowledgeStatus:invalid");
  if (typeof event.createdAt !== "string" || Number.isNaN(Date.parse(event.createdAt))) failures.push("createdAt:invalid");
  return failures;
}

export function canKnowledgeRoute(status: KnowledgeStatus, sourceSha: string, currentSha: string): boolean {
  return status === "PROMOTED" && sourceSha === currentSha;
}

export function xpReasonIsRewardable(reason: string): reason is XpRewardReason {
  return (XP_REWARD_REASONS as readonly string[]).includes(reason);
}
