import {
  canPromote,
  type CandidateState,
  type PromotionGate,
} from "./cell-control-plane";
import {
  validateCanonicalCellAssignment,
  type CanonicalCellAssignment,
  type OppositionPlan,
  type CellFalsificationPolicy,
  type CellVerificationPolicy,
  type CellIndependencePolicy,
} from "./cell-assignment";
import {
  type KnowledgeRecord,
} from "./agent-learning";

export const CELL_LIFECYCLE_CONTRACT_VERSION = "1.0.0" as const;

export const CELL_LIFECYCLE_STAGES = [
  "MISSION",
  "ADMITTED",
  "ASSIGNED",
  "PAIR_LOCKED",
  "OPPONENT_STARTED",
  "SOLVING",
  "FALSIFYING",
  "RECONCILING",
  "ARBITRATING",
  "CANDIDATE",
  "RED_TEAM",
  "VERIFICATION_PENDING",
  "VERIFIED",
  "CERTIFIED",
  "PROMOTED",
  "LEARNED",
  "FRONTIER",
] as const;
export type CellLifecycleStage = (typeof CELL_LIFECYCLE_STAGES)[number];

export type CellAdmissionEnvelope = Readonly<{
  taskId: string;
  missionId: string;
  objective: string;
  assignment: CanonicalCellAssignment;
  assignmentId: string;
  startingSha: string;
  currentSha: string;
  constraints: readonly string[];
  acceptanceCriteria: readonly string[];
  relevantEvidence: readonly string[];
  oppositionPlan: OppositionPlan;
  falsificationPolicy: CellFalsificationPolicy;
  verificationPolicy: CellVerificationPolicy;
  independencePolicy: CellIndependencePolicy;
}>;

export type CellAdmissionRecord = Readonly<{
  taskId: string;
  assignmentId: string;
  missionId: string;
  startingSha: string;
  currentSha: string;
  admittedAtSequence: number;
  admittedAtMs: number;
  stage: "ADMITTED";
  assignment: CanonicalCellAssignment;
  objective: string;
  constraints: readonly string[];
  acceptanceCriteria: readonly string[];
  relevantEvidence: readonly string[];
}>;

export type CellClaim = Readonly<{
  claimId: string;
  taskId: string;
  assignmentId: string;
  solverId: string;
  statement: string;
  candidateSha: string;
  evidenceIds: readonly string[];
  sequence: number;
}>;

export type CellCounterclaim = Readonly<{
  counterclaimId: string;
  taskId: string;
  assignmentId: string;
  opponentId: string;
  claimId: string;
  statement: string;
  candidateSha: string;
  evidenceIds: readonly string[];
  sequence: number;
}>;

export type CellEvidence = Readonly<{
  evidenceId: string;
  taskId: string;
  assignmentId: string;
  sourceSha: string;
  candidateSha: string;
  kind: "CLAIM_SUPPORT" | "DISPROOF" | "RECONCILIATION" | "VERIFICATION";
  summary: string;
  independent: boolean;
  sequence: number;
}>;

export type CellDisposition =
  | "RESOLVED"
  | "MORE_EVIDENCE"
  | "REPLAN"
  | "ESCALATE"
  | "DISPUTED";

export type CellArbitrationRecord = Readonly<{
  arbitrationId: string;
  taskId: string;
  assignmentId: string;
  arbiterId: string;
  claimId: string;
  counterclaimId: string;
  evidenceIds: readonly string[];
  disposition: CellDisposition;
  rationale: string;
  candidateSha: string;
  sequence: number;
}>;

export type CellReconciliationRecord = Readonly<{
  taskId: string;
  assignmentId: string;
  claimId: string;
  counterclaimId: string;
  evidenceIds: readonly string[];
  conflicts: readonly string[];
  dispositioned: boolean;
  candidateSha: string;
  sequence: number;
}>;

export type CellCandidateHandoff = Readonly<{
  candidateId: string;
  taskId: string;
  missionId: string;
  assignmentId: string;
  candidateSha: string;
  solverResult: string;
  opponentChallenge: string;
  exchangeComplete: boolean;
  conflictsDispositioned: boolean;
  evidenceIds: readonly string[];
  handoffRefs: readonly string[];
  createdAtSequence: number;
}>;

export type CellRedTeamRecord = Readonly<{
  redTeamId: string;
  candidateId: string;
  taskId: string;
  redTeamAgentId: string;
  candidateSha: string;
  attackSurfaceChecks: readonly string[];
  findings: readonly string[];
  passed: boolean;
  sequence: number;
}>;

export type CellVerificationRecord = Readonly<{
  verificationId: string;
  candidateId: string;
  taskId: string;
  verifierId: string;
  candidateSha: string;
  evidenceIds: readonly string[];
  checks: readonly string[];
  passed: boolean;
  sequence: number;
}>;

export type CellCertificationRecord = Readonly<{
  certificationId: string;
  candidateId: string;
  taskId: string;
  certifierId: string;
  governanceRef: string;
  certifiedSha: string;
  verifiedSha: string;
  passed: boolean;
  sequence: number;
}>;

export type CellPromotionRecord = Readonly<{
  candidateId: string;
  taskId: string;
  promotedSha: string;
  promotionRef: string;
  certifiedSha: string;
  sequence: number;
}>;

export type CellLearningInput = Readonly<{
  knowledgeId: string;
  taskId: string;
  agentId: string;
  claim: string;
  sourceSha: string;
  evidenceIds: readonly string[];
  independentConfirmations: number;
  regressionPassed: boolean;
}>;

export type CellFrontierProposal = Readonly<{
  frontierId: string;
  sourceTaskId: string;
  sourceCandidateId: string;
  sourceSha: string;
  proposerId: string;
  hypothesis: string;
  expectedImprovement: number;
  informationGain: number;
  risk: number;
  reversible: boolean;
  nextTaskProposal: string;
  sequence: number;
}>;

export type CellLifecycleSnapshot = Readonly<{
  stage: CellLifecycleStage;
  admission: CellAdmissionRecord | null;
  claim: CellClaim | null;
  counterclaim: CellCounterclaim | null;
  evidence: readonly CellEvidence[];
  reconciliation: CellReconciliationRecord | null;
  arbitration: CellArbitrationRecord | null;
  candidate: CellCandidateHandoff | null;
  redTeam: CellRedTeamRecord | null;
  verification: CellVerificationRecord | null;
  certification: CellCertificationRecord | null;
  promotion: CellPromotionRecord | null;
  learning: KnowledgeRecord | null;
  frontier: CellFrontierProposal | null;
  opponentStartSequence: number | null;
  solverDisclosureSequence: number | null;
}>;

const SHA_PATTERN = /^[0-9a-f]{40}$/iu;

function required(value: string, code: string): void {
  if (typeof value !== "string" || value.trim() === "") throw new Error(code);
}

function requiredList(values: readonly string[], code: string): void {
  if (values.length === 0 || values.some((value) => value.trim() === "")) {
    throw new Error(code);
  }
}

function sha(value: string, code: string): void {
  if (!SHA_PATTERN.test(value)) throw new Error(code);
}

function unique(values: readonly string[], code: string): void {
  if (new Set(values).size !== values.length) throw new Error(code);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}


export function validateCellAdmission(envelope: CellAdmissionEnvelope): void {
  required(envelope.taskId, "CELL_ADMISSION_TASK_REQUIRED");
  required(envelope.missionId, "CELL_ADMISSION_MISSION_REQUIRED");
  required(envelope.objective, "CELL_ADMISSION_OBJECTIVE_REQUIRED");
  sha(envelope.startingSha, "CELL_ADMISSION_START_SHA_INVALID");
  sha(envelope.currentSha, "CELL_ADMISSION_CURRENT_SHA_INVALID");
  if (envelope.startingSha !== envelope.currentSha) throw new Error("CELL_ADMISSION_SHA_DRIFT");
  requiredList(envelope.constraints, "CELL_ADMISSION_CONSTRAINTS_REQUIRED");
  requiredList(envelope.acceptanceCriteria, "CELL_ADMISSION_ACCEPTANCE_REQUIRED");
  requiredList(envelope.relevantEvidence, "CELL_ADMISSION_EVIDENCE_REQUIRED");
  validateCanonicalCellAssignment(envelope.assignment);
  required(envelope.assignmentId, "CELL_ADMISSION_ASSIGNMENT_REQUIRED");
  if (envelope.assignmentId !== envelope.assignment.assignmentId) {
    throw new Error("CELL_ADMISSION_ASSIGNMENT_MISMATCH");
  }

  if (envelope.assignment.taskId !== envelope.taskId) {
    throw new Error("CELL_ADMISSION_TASK_MISMATCH");
  }
  if (envelope.assignment.missionId !== envelope.missionId) {
    throw new Error("CELL_ADMISSION_MISSION_MISMATCH");
  }
  if (!sameJson(envelope.assignment.oppositionPlan, envelope.oppositionPlan)) {
    throw new Error("CELL_ADMISSION_OPPOSITION_PLAN_MISMATCH");
  }
  if (!sameJson(envelope.assignment.falsificationPolicy, envelope.falsificationPolicy)) {
    throw new Error("CELL_ADMISSION_FALSIFICATION_POLICY_MISMATCH");
  }
  if (!sameJson(envelope.assignment.verificationPolicy, envelope.verificationPolicy)) {
    throw new Error("CELL_ADMISSION_VERIFICATION_POLICY_MISMATCH");
  }
  if (!sameJson(envelope.assignment.independencePolicy, envelope.independencePolicy)) {
    throw new Error("CELL_ADMISSION_INDEPENDENCE_POLICY_MISMATCH");
  }
}

export function createCellAdmissionRecord(
  envelope: CellAdmissionEnvelope,
  sequence: number,
  nowMs: number,
): CellAdmissionRecord {
  validateCellAdmission(envelope);
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error("CELL_ADMISSION_SEQUENCE_INVALID");
  if (!Number.isFinite(nowMs)) throw new Error("CELL_ADMISSION_TIME_INVALID");

  return Object.freeze({
    taskId: envelope.taskId,
    assignmentId: envelope.assignmentId,
    missionId: envelope.missionId,
    startingSha: envelope.startingSha,
    currentSha: envelope.currentSha,
    admittedAtSequence: sequence,
    admittedAtMs: nowMs,
    stage: "ADMITTED" as const,
    assignment: envelope.assignment,
    objective: envelope.objective.trim(),
    constraints: Object.freeze([...envelope.constraints]),
    acceptanceCriteria: Object.freeze([...envelope.acceptanceCriteria]),
    relevantEvidence: Object.freeze([...envelope.relevantEvidence]),
  });
}

export function validateClaim(taskId: string, assignmentId: string, solverId: string, candidateSha: string, statement: string, evidenceIds: readonly string[]): void {
  required(taskId, "CELL_CLAIM_TASK_REQUIRED");
  required(assignmentId, "CELL_CLAIM_ASSIGNMENT_REQUIRED");
  required(solverId, "CELL_CLAIM_SOLVER_REQUIRED");
  required(statement, "CELL_CLAIM_STATEMENT_REQUIRED");
  sha(candidateSha, "CELL_CLAIM_SHA_INVALID");
  requiredList(evidenceIds, "CELL_CLAIM_EVIDENCE_REQUIRED");
  unique(evidenceIds, "CELL_CLAIM_EVIDENCE_DUPLICATE");
}

function ensureEvidenceRefs(known: readonly CellEvidence[], requiredIds: readonly string[], code: string): void {
  const knownIds = new Set(known.map((entry) => entry.evidenceId));
  if (requiredIds.some((id) => !knownIds.has(id))) throw new Error(code);
}

export function validateCounterclaim(
  taskId: string,
  assignmentId: string,
  opponentId: string,
  claimId: string,
  candidateSha: string,
  statement: string,
  evidenceIds: readonly string[],
): void {
  required(taskId, "CELL_COUNTERCLAIM_TASK_REQUIRED");
  required(assignmentId, "CELL_COUNTERCLAIM_ASSIGNMENT_REQUIRED");
  required(opponentId, "CELL_COUNTERCLAIM_OPPONENT_REQUIRED");
  required(claimId, "CELL_COUNTERCLAIM_CLAIM_REQUIRED");
  required(statement, "CELL_COUNTERCLAIM_STATEMENT_REQUIRED");
  sha(candidateSha, "CELL_COUNTERCLAIM_SHA_INVALID");
  requiredList(evidenceIds, "CELL_COUNTERCLAIM_EVIDENCE_REQUIRED");
  unique(evidenceIds, "CELL_COUNTERCLAIM_EVIDENCE_DUPLICATE");
}

export function validateCellPromotionGate(
  gate: PromotionGate,
  currentRuntimeSha: string,
): boolean {
  sha(currentRuntimeSha, "CELL_PROMOTION_RUNTIME_SHA_INVALID");
  return canPromote(gate, currentRuntimeSha);
}

export class CellLifecycleRuntime {
  private stage: CellLifecycleStage = "MISSION";
  private sequence = 0;
  private admission: CellAdmissionRecord | null = null;
  private claim: CellClaim | null = null;
  private counterclaim: CellCounterclaim | null = null;
  private evidence: CellEvidence[] = [];
  private reconciliation: CellReconciliationRecord | null = null;
  private arbitration: CellArbitrationRecord | null = null;
  private candidate: CellCandidateHandoff | null = null;
  private redTeam: CellRedTeamRecord | null = null;
  private verification: CellVerificationRecord | null = null;
  private certification: CellCertificationRecord | null = null;
  private promotion: CellPromotionRecord | null = null;
  private learning: KnowledgeRecord | null = null;
  private frontier: CellFrontierProposal | null = null;
  private opponentStartSequence: number | null = null;
  private solverDisclosureSequence: number | null = null;
  private readonly clock: () => number;

  constructor(clock: () => number = () => Date.now()) {
    this.clock = clock;
  }

  private next(): number {
    return ++this.sequence;
  }

  private requireStage(...allowed: readonly CellLifecycleStage[]): void {
    if (!allowed.includes(this.stage)) {
      throw new Error(`CELL_STAGE_INVALID:${this.stage}`);
    }
  }

  getStage(): CellLifecycleStage {
    return this.stage;
  }

  snapshot(): CellLifecycleSnapshot {
    return Object.freeze({
      stage: this.stage,
      admission: this.admission,
      claim: this.claim,
      counterclaim: this.counterclaim,
      evidence: Object.freeze([...this.evidence]),
      reconciliation: this.reconciliation,
      arbitration: this.arbitration,
      candidate: this.candidate,
      redTeam: this.redTeam,
      verification: this.verification,
      certification: this.certification,
      promotion: this.promotion,
      learning: this.learning,
      frontier: this.frontier,
      opponentStartSequence: this.opponentStartSequence,
      solverDisclosureSequence: this.solverDisclosureSequence,
    });
  }

  admit(envelope: CellAdmissionEnvelope): CellAdmissionRecord {
    this.requireStage("MISSION");
    const record = createCellAdmissionRecord(envelope, this.next(), this.clock());
    this.admission = record;
    this.stage = "ADMITTED";
    return record;
  }

  lockPair(): void {
    this.requireStage("ADMITTED");
    this.stage = "ASSIGNED";
    this.stage = "PAIR_LOCKED";
  }

  recordOpponentIndependentStart(opponentId: string, candidateSha: string, sequence?: number): void {
    this.requireStage("PAIR_LOCKED");
    required(opponentId, "CELL_OPPONENT_ID_REQUIRED");
    sha(candidateSha, "CELL_OPPONENT_SHA_INVALID");
    if (!this.admission || opponentId !== this.admission.assignment.opponentId) {
      throw new Error("CELL_OPPONENT_ID_MISMATCH");
    }
    if (sequence !== undefined) {
      if (!Number.isInteger(sequence) || sequence <= this.sequence) throw new Error("CELL_OPPONENT_SEQUENCE_INVALID");
      this.sequence = sequence;
      this.opponentStartSequence = sequence;
    } else {
      this.opponentStartSequence = this.next();
    }
    this.stage = "OPPONENT_STARTED";
  }

  discloseSolverResult(candidateSha: string): void {
    this.requireStage("OPPONENT_STARTED", "SOLVING");
    sha(candidateSha, "CELL_SOLVER_DISCLOSURE_SHA_INVALID");
    if (!this.admission || candidateSha !== this.admission.currentSha) throw new Error("CELL_SOLVER_DISCLOSURE_SHA_DRIFT");
    if (this.solverDisclosureSequence !== null) throw new Error("CELL_SOLVER_DISCLOSURE_ALREADY_RECORDED");
    if (this.opponentStartSequence === null) throw new Error("CELL_OPPONENT_INDEPENDENCE_REQUIRED");
    this.solverDisclosureSequence = this.next();
    if (this.solverDisclosureSequence <= this.opponentStartSequence) {
      throw new Error("CELL_OPPONENT_ORDERING_INVALID");
    }
    this.stage = "SOLVING";
  }

  startFalsification(): void {
    this.requireStage("SOLVING");
    if (!this.admission?.assignment.falsificationPolicy.required) {
      throw new Error("CELL_FALSIFICATION_REQUIRED");
    }
    this.stage = "FALSIFYING";
  }

  recordClaim(input: Omit<CellClaim, "sequence" | "taskId">): CellClaim {
    this.requireStage("SOLVING", "FALSIFYING");
    if (!this.admission) throw new Error("CELL_ADMISSION_REQUIRED");
    const taskId = this.admission.taskId;
    const assignmentId = this.admission.assignmentId;
    if (this.claim) throw new Error("CELL_CLAIM_ALREADY_EXISTS");
    return (() => {
      validateClaim(
        taskId,
        input.assignmentId,
        input.solverId,
        input.candidateSha,
        input.statement,
        input.evidenceIds,
      );
      if (input.assignmentId !== assignmentId) {
        throw new Error("CELL_CLAIM_ASSIGNMENT_MISMATCH");
      }
      if (input.solverId !== this.admission!.assignment.solverId) {
        throw new Error("CELL_CLAIM_SOLVER_MISMATCH");
      }
      if (input.candidateSha !== this.admission!.currentSha) {
        throw new Error("CELL_CLAIM_SHA_DRIFT");
      }
      const record = Object.freeze({
        ...input,
        taskId,
        assignmentId,
        sequence: this.next(),
        evidenceIds: Object.freeze([...input.evidenceIds]),
      });
      this.claim = record;
      return record;
    })();
  }

  recordCounterclaim(input: Omit<CellCounterclaim, "sequence" | "taskId">): CellCounterclaim {
    this.requireStage("FALSIFYING");
    if (!this.admission || !this.claim) throw new Error("CELL_CLAIM_REQUIRED");
    validateCounterclaim(
      this.admission.taskId,
      input.assignmentId,
      input.opponentId,
      input.claimId,
      input.candidateSha,
      input.statement,
      input.evidenceIds,
    );
    if (input.assignmentId !== this.claim.assignmentId) throw new Error("CELL_COUNTERCLAIM_ASSIGNMENT_MISMATCH");
    if (input.candidateSha !== this.admission.currentSha) throw new Error("CELL_COUNTERCLAIM_SHA_DRIFT");
    if (input.claimId !== this.claim.claimId) throw new Error("CELL_COUNTERCLAIM_CLAIM_MISMATCH");
    if (input.opponentId !== this.admission.assignment.opponentId) throw new Error("CELL_COUNTERCLAIM_OPPONENT_MISMATCH");
    const record = Object.freeze({
      ...input,
      taskId: this.admission.taskId,
      assignmentId: this.claim.assignmentId,
      sequence: this.next(),
      evidenceIds: Object.freeze([...input.evidenceIds]),
    });
    if (this.counterclaim) throw new Error("CELL_COUNTERCLAIM_ALREADY_EXISTS");
    this.counterclaim = record;
    return record;
  }

  recordEvidence(input: Omit<CellEvidence, "sequence" | "taskId" | "assignmentId">): CellEvidence {
    this.requireStage("FALSIFYING", "RECONCILING", "ARBITRATING", "RED_TEAM");
    if (!this.admission) throw new Error("CELL_ADMISSION_REQUIRED");
    if (input.candidateSha !== input.sourceSha) {
      throw new Error("CELL_EVIDENCE_SHA_MISMATCH");
    }
    sha(input.sourceSha, "CELL_EVIDENCE_SHA_INVALID");
    if (input.sourceSha !== this.admission.currentSha) throw new Error("CELL_EVIDENCE_SHA_DRIFT");
    required(input.evidenceId, "CELL_EVIDENCE_ID_REQUIRED");
    required(input.summary, "CELL_EVIDENCE_SUMMARY_REQUIRED");
    if (this.evidence.some((entry) => entry.evidenceId === input.evidenceId)) {
      throw new Error("CELL_EVIDENCE_ALREADY_EXISTS");
    }
    const record = Object.freeze({
      ...input,
      taskId: this.admission.taskId,
      assignmentId: this.admission.assignmentId,
      sequence: this.next(),
    });
    this.evidence.push(record);
    return record;
  }

  reconcile(conflicts: readonly string[], candidateSha: string): CellReconciliationRecord {
    this.requireStage("FALSIFYING");
    if (!this.claim || !this.counterclaim) throw new Error("CELL_EXCHANGE_INCOMPLETE");
    sha(candidateSha, "CELL_RECONCILIATION_SHA_INVALID");
    if (candidateSha !== this.claim.candidateSha || candidateSha !== this.counterclaim.candidateSha) {
      throw new Error("CELL_RECONCILIATION_SHA_MISMATCH");
    }
    requiredList(this.claim.evidenceIds, "CELL_CLAIM_EVIDENCE_REQUIRED");
    requiredList(this.counterclaim.evidenceIds, "CELL_COUNTERCLAIM_EVIDENCE_REQUIRED");
    ensureEvidenceRefs(this.evidence, this.claim.evidenceIds, "CELL_CLAIM_EVIDENCE_UNRECORDED");
    ensureEvidenceRefs(this.evidence, this.counterclaim.evidenceIds, "CELL_COUNTERCLAIM_EVIDENCE_UNRECORDED");
    this.reconciliation = Object.freeze({
      taskId: this.admission!.taskId,
      assignmentId: this.claim.assignmentId,
      claimId: this.claim.claimId,
      counterclaimId: this.counterclaim.counterclaimId,
      evidenceIds: Object.freeze([...new Set([...this.claim.evidenceIds, ...this.counterclaim.evidenceIds])]),
      conflicts: Object.freeze([...conflicts]),
      dispositioned: conflicts.length === 0,
      candidateSha,
      sequence: this.next(),
    });
    this.stage = conflicts.length === 0 ? "RECONCILING" : "ARBITRATING";
    return this.reconciliation;
  }

  arbitrate(input: Omit<CellArbitrationRecord, "sequence" | "taskId" | "assignmentId">): CellArbitrationRecord {
    this.requireStage("ARBITRATING", "RECONCILING");
    if (!this.admission || !this.claim || !this.counterclaim || !this.reconciliation) {
      throw new Error("CELL_ARBITRATION_CONTEXT_INCOMPLETE");
    }
    required(input.arbiterId, "CELL_ARBITER_REQUIRED");
    if ([this.admission.assignment.solverId, this.admission.assignment.opponentId].includes(input.arbiterId)) {
      throw new Error("CELL_SELF_ARBITRATION_FORBIDDEN");
    }
    if (input.claimId !== this.claim.claimId || input.counterclaimId !== this.counterclaim.counterclaimId) {
      throw new Error("CELL_ARBITRATION_CLAIM_LINK_INVALID");
    }
    if (!["RESOLVED", "MORE_EVIDENCE", "REPLAN", "ESCALATE", "DISPUTED"].includes(input.disposition)) {
      throw new Error("CELL_ARBITRATION_DISPOSITION_INVALID");
    }
    required(input.rationale, "CELL_ARBITRATION_RATIONALE_REQUIRED");
    sha(input.candidateSha, "CELL_ARBITRATION_SHA_INVALID");
    if (input.candidateSha !== this.reconciliation.candidateSha) throw new Error("CELL_ARBITRATION_SHA_MISMATCH");
    if (input.evidenceIds.length === 0) throw new Error("CELL_ARBITRATION_EVIDENCE_REQUIRED");
    ensureEvidenceRefs(this.evidence, input.evidenceIds, "CELL_ARBITRATION_EVIDENCE_UNRECORDED");
    this.arbitration = Object.freeze({
      ...input,
      taskId: this.admission.taskId,
      assignmentId: this.claim.assignmentId,
      sequence: this.next(),
      evidenceIds: Object.freeze([...input.evidenceIds]),
    });
    if (input.disposition === "DISPUTED") {
      this.stage = "ARBITRATING";
    } else if (input.disposition === "MORE_EVIDENCE") {
      this.stage = "FALSIFYING";
    } else if (input.disposition === "REPLAN" || input.disposition === "ESCALATE") {
      this.stage = "ADMITTED";
    } else {
      this.reconciliation = Object.freeze({ ...this.reconciliation, conflicts: Object.freeze([]), dispositioned: true });
      this.stage = "RECONCILING";
    }
    return this.arbitration;
  }

  createCandidate(
    input: Omit<CellCandidateHandoff, "taskId" | "missionId" | "assignmentId" | "createdAtSequence">,
  ): CellCandidateHandoff {
    this.requireStage("RECONCILING");
    if (!this.admission || !this.claim || !this.counterclaim || !this.reconciliation) {
      throw new Error("CELL_CANDIDATE_CONTEXT_INCOMPLETE");
    }
    if (!this.reconciliation.dispositioned) throw new Error("CELL_CANDIDATE_CONFLICTS_NOT_DISPOSITIONED");
    if (!this.arbitration && this.reconciliation.conflicts.length > 0) throw new Error("CELL_ARBITRATION_REQUIRED");
    sha(input.candidateSha, "CELL_CANDIDATE_SHA_INVALID");
    if (input.candidateSha !== this.claim.candidateSha || input.candidateSha !== this.counterclaim.candidateSha) {
      throw new Error("CELL_CANDIDATE_SHA_MISMATCH");
    }
    if (!input.exchangeComplete) throw new Error("CELL_CANDIDATE_EXCHANGE_INCOMPLETE");
    if (!input.conflictsDispositioned) throw new Error("CELL_CANDIDATE_CONFLICTS_NOT_DISPOSITIONED");
    required(input.solverResult, "CELL_CANDIDATE_SOLVER_RESULT_REQUIRED");
    required(input.opponentChallenge, "CELL_CANDIDATE_OPPONENT_CHALLENGE_REQUIRED");
    requiredList(input.evidenceIds, "CELL_CANDIDATE_EVIDENCE_REQUIRED");
    requiredList(input.handoffRefs, "CELL_CANDIDATE_HANDOFF_REQUIRED");
    ensureEvidenceRefs(this.evidence, input.evidenceIds, "CELL_CANDIDATE_EVIDENCE_UNRECORDED");
    this.candidate = Object.freeze({
      ...input,
      taskId: this.admission.taskId,
      missionId: this.admission.missionId,
      assignmentId: this.claim.assignmentId,
      createdAtSequence: this.next(),
      evidenceIds: Object.freeze([...new Set(input.evidenceIds)]),
      handoffRefs: Object.freeze([...input.handoffRefs]),
    });
    this.stage = "CANDIDATE";
    return this.candidate;
  }

  redTeamReview(
    input: Omit<CellRedTeamRecord, "taskId" | "candidateId" | "candidateSha" | "sequence">,
  ): CellRedTeamRecord {
    this.requireStage("CANDIDATE");
    if (!this.candidate || !this.admission) throw new Error("CELL_CANDIDATE_REQUIRED");
    required(input.redTeamAgentId, "CELL_RED_TEAM_AGENT_REQUIRED");
    if ([this.admission.assignment.solverId, this.admission.assignment.opponentId].includes(input.redTeamAgentId)) {
      throw new Error("CELL_RED_TEAM_IDENTITY_COLLISION");
    }
    requiredList(input.attackSurfaceChecks, "CELL_RED_TEAM_ATTACK_SURFACE_REQUIRED");
    required(input.redTeamId, "CELL_RED_TEAM_ID_REQUIRED");
    sha(this.candidate.candidateSha, "CELL_RED_TEAM_SHA_INVALID");
    this.redTeam = Object.freeze({
      ...input,
      candidateId: this.candidate.candidateId,
      taskId: this.candidate.taskId,
      candidateSha: this.candidate.candidateSha,
      sequence: this.next(),
      attackSurfaceChecks: Object.freeze([...input.attackSurfaceChecks]),
      findings: Object.freeze([...input.findings]),
    });
    this.stage = input.passed ? "VERIFICATION_PENDING" : "CANDIDATE";
    return this.redTeam;
  }

  independentlyVerify(
    input: Omit<CellVerificationRecord, "candidateId" | "taskId" | "candidateSha" | "sequence">,
  ): CellVerificationRecord {
    this.requireStage("VERIFICATION_PENDING");
    if (!this.candidate || !this.redTeam || !this.admission) throw new Error("CELL_VERIFICATION_CONTEXT_INCOMPLETE");
    required(input.verificationId, "CELL_VERIFICATION_ID_REQUIRED");
    required(input.verifierId, "CELL_VERIFIER_REQUIRED");
    if ([this.admission.assignment.solverId, this.admission.assignment.opponentId, this.redTeam.redTeamAgentId].includes(input.verifierId)) {
      throw new Error("CELL_VERIFIER_IDENTITY_COLLISION");
    }
    requiredList(input.checks, "CELL_VERIFICATION_CHECKS_REQUIRED");
    requiredList(input.evidenceIds, "CELL_VERIFICATION_EVIDENCE_REQUIRED");
    ensureEvidenceRefs(this.evidence, input.evidenceIds, "CELL_VERIFICATION_EVIDENCE_UNRECORDED");
    const record = Object.freeze({
      ...input,
      candidateId: this.candidate.candidateId,
      taskId: this.candidate.taskId,
      candidateSha: this.candidate.candidateSha,
      sequence: this.next(),
      evidenceIds: Object.freeze([...input.evidenceIds]),
    } as CellVerificationRecord);
    if (!record.passed) {
      this.verification = record;
      this.stage = "CANDIDATE";
      return record;
    }
    this.verification = record;
    this.stage = "VERIFIED";
    return record;
  }

  certify(input: Omit<CellCertificationRecord, "candidateId" | "taskId" | "certifiedSha" | "verifiedSha" | "sequence">): CellCertificationRecord {
    this.requireStage("VERIFIED");
    if (!this.candidate || !this.verification || !this.verification.passed) {
      throw new Error("CELL_VERIFICATION_REQUIRED");
    }
    required(input.certificationId, "CELL_CERTIFICATION_ID_REQUIRED");
    required(input.certifierId, "CELL_CERTIFIER_REQUIRED");
    required(input.governanceRef, "CELL_GOVERNANCE_REF_REQUIRED");
    if ([this.admission?.assignment.solverId, this.admission?.assignment.opponentId, this.redTeam?.redTeamAgentId, this.verification.verifierId].includes(input.certifierId)) {
      throw new Error("CELL_CERTIFIER_IDENTITY_COLLISION");
    }
    if (!input.passed) {
      throw new Error("CELL_CERTIFICATION_FAILED");
    }
    const record = Object.freeze({
      ...input,
      candidateId: this.candidate.candidateId,
      taskId: this.candidate.taskId,
      certifiedSha: this.candidate.candidateSha,
      verifiedSha: this.candidate.candidateSha,
      sequence: this.next(),
    });
    this.certification = record;
    this.stage = "CERTIFIED";
    return record;
  }

  promote(input: Readonly<{
    gate: PromotionGate;
    currentRuntimeSha: string;
    promotionRef: string;
  }>): CellPromotionRecord {
    this.requireStage("CERTIFIED");
    if (!this.candidate || !this.certification || !this.certification.passed || this.certification.certifiedSha !== this.candidate.candidateSha) {
      throw new Error("CELL_CERTIFICATION_BINDING_INVALID");
    }
    required(input.promotionRef, "CELL_PROMOTION_REF_REQUIRED");
    if (!validateCellPromotionGate(input.gate, input.currentRuntimeSha)) {
      throw new Error("CELL_PROMOTION_DENIED");
    }
    if (input.gate.certifiedSha !== this.candidate.candidateSha) {
      throw new Error("CELL_PROMOTION_CANDIDATE_SHA_MISMATCH");
    }
    const record = Object.freeze({
      candidateId: this.candidate.candidateId,
      taskId: this.candidate.taskId,
      promotedSha: input.currentRuntimeSha,
      promotionRef: input.promotionRef,
      certifiedSha: input.gate.certifiedSha!,
      sequence: this.next(),
    });
    this.promotion = record;
    this.stage = "PROMOTED";
    return record;
  }

  learn(input: CellLearningInput): KnowledgeRecord {
    this.requireStage("PROMOTED");
    if (!this.candidate || !this.promotion || !this.admission) throw new Error("CELL_LEARNING_CONTEXT_REQUIRED");
    required(input.knowledgeId, "CELL_KNOWLEDGE_ID_REQUIRED");
    required(input.claim, "CELL_KNOWLEDGE_CLAIM_REQUIRED");
    sha(input.sourceSha, "CELL_KNOWLEDGE_SHA_INVALID");
    if (input.sourceSha !== this.promotion.promotedSha) throw new Error("CELL_LEARNING_SHA_DRIFT");
    if (input.taskId !== this.candidate.taskId) throw new Error("CELL_LEARNING_TASK_MISMATCH");
    requiredList(input.evidenceIds, "CELL_LEARNING_EVIDENCE_REQUIRED");
    ensureEvidenceRefs(this.evidence, input.evidenceIds, "CELL_LEARNING_EVIDENCE_UNRECORDED");
    if (!input.regressionPassed) throw new Error("CELL_LEARNING_REGRESSION_REQUIRED");
    if (input.independentConfirmations < 1) throw new Error("CELL_LEARNING_INDEPENDENT_CONFIRMATION_REQUIRED");
    const record: KnowledgeRecord = Object.freeze({
      knowledgeId: input.knowledgeId,
      claim: input.claim.trim(),
      stage: "PROMOTED",
      status: "PROMOTED",
      sourceSha: input.sourceSha,
      confidence: 1,
      evidenceIds: Object.freeze([...input.evidenceIds]),
      independentConfirmations: input.independentConfirmations,
      usefulCount: 1,
      harmfulCount: 0,
      regressionPassed: true,
      updatedAt: new Date(this.clock()).toISOString(),
      supersedes: null,
    });
    this.learning = record;
    this.stage = "LEARNED";
    return record;
  }

  openFrontier(input: Omit<CellFrontierProposal, "sourceTaskId" | "sourceCandidateId" | "sourceSha" | "sequence">): CellFrontierProposal {
    this.requireStage("LEARNED");
    if (!this.promotion || !this.candidate) throw new Error("CELL_FRONTIER_PROMOTION_REQUIRED");
    required(input.frontierId, "CELL_FRONTIER_ID_REQUIRED");
    required(input.proposerId, "CELL_FRONTIER_PROPOSER_REQUIRED");
    required(input.hypothesis, "CELL_FRONTIER_HYPOTHESIS_REQUIRED");
    required(input.nextTaskProposal, "CELL_FRONTIER_TASK_REQUIRED");
    if (!input.reversible) throw new Error("CELL_FRONTIER_REVERSIBILITY_REQUIRED");
    if (!Number.isFinite(input.expectedImprovement) || !Number.isFinite(input.informationGain) || !Number.isFinite(input.risk)) {
      throw new Error("CELL_FRONTIER_METRICS_INVALID");
    }
    const record = Object.freeze({
      ...input,
      sourceTaskId: this.candidate.taskId,
      sourceCandidateId: this.candidate.candidateId,
      sourceSha: this.promotion.promotedSha,
      sequence: this.next(),
    });
    this.frontier = record;
    this.stage = "FRONTIER";
    return record;
  }
}
