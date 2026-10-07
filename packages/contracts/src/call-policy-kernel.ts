export const CALL_POLICY_KERNEL_VERSION = "1.0.0" as const;

export type PlanObjectionType =
  | "STRUCTURAL" | "EVIDENCE_GAP" | "SECURITY" | "SCOPE" | "FEASIBILITY"
  | "POLICY" | "SHA_INTEGRITY" | "INDEPENDENCE" | "BUDGET" | "CONTRADICTION";

export type PlanDisposition = "APPROVED" | "REPLAN" | "ADD_EVIDENCE" | "ESCALATE";

export type GateFailure =
  | "SCHEMA_VIOLATION" | "SHA_MISMATCH" | "CONTEXT_MISMATCH" | "INDEPENDENCE_BREACH"
  | "DISCLOSURE_VIOLATION" | "EVIDENCE_INSUFFICIENT" | "EVIDENCE_INVALID"
  | "POLICY_VIOLATION" | "BUDGET_EXHAUSTED" | "ITERATION_LIMIT" | "TIMEOUT"
  | "CONTRADICTION_UNRESOLVED" | "ARTIFACT_RETIRED" | "ARTIFACT_INVALIDATED"
  | "AUTHORITY_VIOLATION" | "VERIFICATION_FAILED" | "RED_TEAM_FAILED" | "PROMOTION_BLOCKED";

export type PlanObjection = Readonly<{
  type: PlanObjectionType;
  fatal: boolean;
  evidenceRefs: readonly string[];
}>;

export type PolicyDecision = Readonly<{
  disposition: PlanDisposition;
  ruleId: string;
  policyVersion: string;
  failures: readonly GateFailure[];
}>;

export type PolicyInput = Readonly<{
  policyVersion: string;
  planRound: number;
  maxPlanRounds: number;
  retryCount: number;
  maxRetries: number;
  budgetRemaining: boolean;
  acceptanceCriteriaComplete: boolean;
  oppositionPlanComplete: boolean;
  exactShaValid: boolean;
  independenceValid: boolean;
  objections: readonly PlanObjection[];
}>;

function fail(condition: boolean, code: GateFailure): GateFailure[] {
  return condition ? [] : [code];
}

export function decidePlanDisposition(input: PolicyInput): PolicyDecision {
  const failures: GateFailure[] = [
    ...fail(input.acceptanceCriteriaComplete, "SCHEMA_VIOLATION"),
    ...fail(input.oppositionPlanComplete, "SCHEMA_VIOLATION"),
    ...fail(input.exactShaValid, "SHA_MISMATCH"),
    ...fail(input.independenceValid, "INDEPENDENCE_BREACH"),
    ...fail(input.budgetRemaining, "BUDGET_EXHAUSTED"),
  ];

  if (failures.includes("SHA_MISMATCH") || failures.includes("INDEPENDENCE_BREACH")) {
    return Object.freeze({disposition: "ESCALATE", ruleId: "PK-FAIL-CLOSED-INTEGRITY", policyVersion: input.policyVersion, failures});
  }
  if (failures.includes("BUDGET_EXHAUSTED")) {
    return Object.freeze({disposition: "ESCALATE", ruleId: "PK-BUDGET-HARD-STOP", policyVersion: input.policyVersion, failures});
  }
  if (input.planRound >= input.maxPlanRounds) {
    return Object.freeze({disposition: "ESCALATE", ruleId: "PK-PLAN-ROUND-LIMIT", policyVersion: input.policyVersion, failures: [...failures, "ITERATION_LIMIT"]});
  }

  const fatal = input.objections.find((objection) => objection.fatal);
  if (fatal) {
    const fatalDisposition: PlanDisposition =
      fatal.type === "EVIDENCE_GAP" ? "ADD_EVIDENCE" :
      fatal.type === "STRUCTURAL" || fatal.type === "SCOPE" || fatal.type === "FEASIBILITY" ? "REPLAN" :
      "ESCALATE";
    return Object.freeze({disposition: fatalDisposition, ruleId: `PK-OBJECTION-${fatal.type}`, policyVersion: input.policyVersion, failures});
  }

  return Object.freeze({disposition: "APPROVED", ruleId: "PK-PLAN-VALID", policyVersion: input.policyVersion, failures});
}

export function assertPolicyDecision(
  decision: PolicyDecision,
  expectedVersion: string,
): void {
  if (decision.policyVersion !== expectedVersion) throw new Error("POLICY_VERSION_MISMATCH");
  if (decision.disposition === "APPROVED" && decision.failures.length > 0) {
    throw new Error("POLICY_APPROVAL_WITH_FAILURES");
  }
}
