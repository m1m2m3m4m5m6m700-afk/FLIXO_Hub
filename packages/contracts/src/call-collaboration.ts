export const CALL_COLLABORATION_VERSION = "1.0.0" as const;

export type CollaborationSeverity = "STANDARD" | "HARD" | "CRITICAL";

export type CollaborationAgent =
  | "master"
  | "builder"
  | "opponent"
  | "adversary-builder"
  | "adversary-explorer"
  | "explorer"
  | "verifier"
  | "steward";

export type CollaborationProtocol =
  | "PAIR_DEBUG"
  | "ROOT_CAUSE_COUNCIL"
  | "ADVERSARIAL_REPAIR"
  | "VERIFICATION_COUNCIL"
  | "DEADLOCK_COUNCIL";

export type CollaborationHandoffKind =
  | "HYPOTHESIS"
  | "COUNTEREXAMPLE"
  | "PATCH_PROPOSAL"
  | "EVIDENCE"
  | "BLOCKER"
  | "RECONCILIATION";

export type CollaborationMessage = Readonly<{
  messageId: string;
  sessionId: string;
  sender: CollaborationAgent;
  recipient: CollaborationAgent | "council";
  kind: CollaborationHandoffKind;
  claim: string;
  evidenceRefs: readonly string[];
  baseSha: string;
  createdAt: string;
}>;

export type CollaborationSession = Readonly<{
  sessionId: string;
  taskId: string;
  severity: CollaborationSeverity;
  protocol: CollaborationProtocol;
  participants: readonly CollaborationAgent[];
  independentViewsRequired: number;
  maxRounds: number;
  startedAt: string;
}>;

export type CollaborationDecision = Readonly<{
  sessionId: string;
  disposition:
    | "CONTINUE"
    | "REPAIR"
    | "REPLAN"
    | "ESCALATE"
    | "BLOCK";
  supportingEvidence: readonly string[];
  unresolvedObjections: readonly string[];
}>;

const HARD_PROTOCOLS: readonly CollaborationProtocol[] = [
  "ROOT_CAUSE_COUNCIL",
  "ADVERSARIAL_REPAIR",
  "VERIFICATION_COUNCIL",
  "DEADLOCK_COUNCIL",
];

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export function shouldConveneCollaboration(input: Readonly<{
  severity: CollaborationSeverity;
  failedAttempts: number;
  unresolvedObjections: number;
  rootCauseConfidence: number;
  verifierConflict: boolean;
}>): boolean {
  return (
    input.severity !== "STANDARD" ||
    input.failedAttempts >= 2 ||
    input.unresolvedObjections > 0 ||
    input.rootCauseConfidence < 0.7 ||
    input.verifierConflict
  );
}

export function selectCollaborationProtocol(input: Readonly<{
  severity: CollaborationSeverity;
  verifierConflict: boolean;
  failedAttempts: number;
  unresolvedObjections: number;
}>): CollaborationProtocol {
  if (input.verifierConflict) return "VERIFICATION_COUNCIL";
  if (input.unresolvedObjections > 0) return "DEADLOCK_COUNCIL";
  if (input.failedAttempts >= 2) return "ADVERSARIAL_REPAIR";
  if (input.severity === "CRITICAL") return "ROOT_CAUSE_COUNCIL";
  return "PAIR_DEBUG";
}

export function createCollaborationSession(input: Readonly<{
  sessionId: string;
  taskId: string;
  severity: CollaborationSeverity;
  protocol: CollaborationProtocol;
  participants: readonly CollaborationAgent[];
  startedAt: string;
}>): CollaborationSession {
  const participants = unique(input.participants);
  if (participants.length < 2) {
    throw new Error("COLLABORATION_REQUIRES_MULTIPLE_AGENTS");
  }
  if (!participants.includes("master")) {
    throw new Error("COLLABORATION_REQUIRES_MASTER_COORDINATION");
  }
  if (input.protocol !== "PAIR_DEBUG" && !participants.includes("opponent")) {
    throw new Error("HARD_COLLABORATION_REQUIRES_OPPOSITION");
  }
  if (input.protocol === "VERIFICATION_COUNCIL" && !participants.includes("verifier")) {
    throw new Error("VERIFICATION_COUNCIL_REQUIRES_VERIFIER");
  }
  if (input.protocol === "ADVERSARIAL_REPAIR" && !participants.includes("adversary-builder")) {
    throw new Error("ADVERSARIAL_REPAIR_REQUIRES_ADVERSARY_BUILDER");
  }

  const independentViewsRequired = Math.min(
    participants.length - 1,
    input.protocol === "DEADLOCK_COUNCIL" ? 3 : 2,
  );

  return Object.freeze({
    sessionId: input.sessionId,
    taskId: input.taskId,
    severity: input.severity,
    protocol: input.protocol,
    participants: Object.freeze(participants),
    independentViewsRequired,
    maxRounds: input.protocol === "DEADLOCK_COUNCIL" ? 4 : 3,
    startedAt: input.startedAt,
  });
}

export function validateCollaborationMessage(
  session: CollaborationSession,
  message: CollaborationMessage,
): void {
  if (message.sessionId !== session.sessionId) {
    throw new Error("COLLABORATION_SESSION_MISMATCH");
  }
  if (!session.participants.includes(message.sender)) {
    throw new Error("COLLABORATION_SENDER_NOT_ADMITTED");
  }
  if (message.recipient !== "council" && !session.participants.includes(message.recipient)) {
    throw new Error("COLLABORATION_RECIPIENT_NOT_ADMITTED");
  }
  if (message.evidenceRefs.length === 0 && message.kind !== "HYPOTHESIS") {
    throw new Error("COLLABORATION_EVIDENCE_REQUIRED");
  }
  if (!message.baseSha) {
    throw new Error("COLLABORATION_SHA_REQUIRED");
  }
}

export function assertIndependentViews(
  session: CollaborationSession,
  messages: readonly CollaborationMessage[],
): void {
  const senders = unique(
    messages
      .filter((message) => message.sessionId === session.sessionId)
      .map((message) => message.sender),
  );
  if (senders.length < session.independentViewsRequired) {
    throw new Error("COLLABORATION_INDEPENDENT_VIEWS_INSUFFICIENT");
  }
}

export function decideCollaboration(
  session: CollaborationSession,
  input: Readonly<{
    messages: readonly CollaborationMessage[];
    unresolvedObjections: readonly string[];
    patchAvailable: boolean;
    evidenceSufficient: boolean;
  }>,
): CollaborationDecision {
  assertIndependentViews(session, input.messages);

  if (!input.evidenceSufficient) {
    return Object.freeze({
      sessionId: session.sessionId,
      disposition: "BLOCK",
      supportingEvidence: [],
      unresolvedObjections: input.unresolvedObjections,
    });
  }

  if (input.unresolvedObjections.length > 0) {
    return Object.freeze({
      sessionId: session.sessionId,
      disposition: session.protocol === "DEADLOCK_COUNCIL" ? "ESCALATE" : "REPLAN",
      supportingEvidence: unique(input.messages.flatMap((message) => message.evidenceRefs)),
      unresolvedObjections: input.unresolvedObjections,
    });
  }

  return Object.freeze({
    sessionId: session.sessionId,
    disposition: input.patchAvailable ? "REPAIR" : "CONTINUE",
    supportingEvidence: unique(input.messages.flatMap((message) => message.evidenceRefs)),
    unresolvedObjections: [],
  });
}

export function isHardCollaborationProtocol(
  protocol: CollaborationProtocol,
): boolean {
  return HARD_PROTOCOLS.includes(protocol);
}
