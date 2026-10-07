import { createHash } from "node:crypto";

export const CALL_POLICY_VERSION = "1.0.0" as const;

export type PolicyDisposition =
  | "ALLOW"
  | "REPLAN"
  | "ADD_EVIDENCE"
  | "BLOCK"
  | "RECONCILE"
  | "ESCALATE";

export type OppositionObjectionType =
  | "STRUCTURAL"
  | "EVIDENCE_GAP"
  | "SECURITY"
  | "SCOPE"
  | "FEASIBILITY"
  | "POLICY"
  | "SHA_INTEGRITY"
  | "INDEPENDENCE"
  | "BUDGET"
  | "CONTRADICTION";

export type CallPolicy = Readonly<{
  version: string;
  rules: Readonly<Record<OppositionObjectionType, PolicyDisposition>>;
  maxPlanRounds: number;
  maxRetries: number;
}>;

export type PolicyDecision = Readonly<{
  disposition: PolicyDisposition;
  ruleId: string;
  policyVersion: string;
  policyHash: string;
  objectionType: OppositionObjectionType | null;
  reversible: boolean;
}>;

const DEFAULT_RULES: Record<OppositionObjectionType, PolicyDisposition> = {
  STRUCTURAL: "REPLAN",
  EVIDENCE_GAP: "ADD_EVIDENCE",
  SECURITY: "BLOCK",
  SCOPE: "REPLAN",
  FEASIBILITY: "REPLAN",
  POLICY: "BLOCK",
  SHA_INTEGRITY: "BLOCK",
  INDEPENDENCE: "BLOCK",
  BUDGET: "BLOCK",
  CONTRADICTION: "RECONCILE",
};

export const DEFAULT_CALL_POLICY: CallPolicy = Object.freeze({
  version: CALL_POLICY_VERSION,
  rules: Object.freeze({ ...DEFAULT_RULES }),
  maxPlanRounds: 3,
  maxRetries: 3,
});

function canonicalPolicy(policy: CallPolicy): string {
  return JSON.stringify({
    version: policy.version,
    rules: Object.fromEntries(Object.entries(policy.rules).sort(([a], [b]) => a.localeCompare(b))),
    maxPlanRounds: policy.maxPlanRounds,
    maxRetries: policy.maxRetries,
  });
}

export function computePolicyHash(policy: CallPolicy = DEFAULT_CALL_POLICY): string {
  if (!Number.isInteger(policy.maxPlanRounds) || policy.maxPlanRounds < 1) throw new Error("CALL_POLICY_PLAN_ROUNDS_INVALID");
  if (!Number.isInteger(policy.maxRetries) || policy.maxRetries < 1) throw new Error("CALL_POLICY_RETRIES_INVALID");
  return createHash("sha256").update(canonicalPolicy(policy), "utf8").digest("hex");
}

export function validatePolicyBinding(policyVersion: string, policyHash: string, policy: CallPolicy = DEFAULT_CALL_POLICY): void {
  if (policyVersion !== policy.version) throw new Error("CALL_POLICY_VERSION_MISMATCH");
  if (policyHash !== computePolicyHash(policy)) throw new Error("CALL_POLICY_HASH_MISMATCH");
}

export function decidePlanDisposition(
  objectionType: OppositionObjectionType | null,
  policyVersion: string,
  policyHash: string,
  policy: CallPolicy = DEFAULT_CALL_POLICY,
  planRound = 0,
): PolicyDecision {
  validatePolicyBinding(policyVersion, policyHash, policy);
  if (!Number.isInteger(planRound) || planRound < 0) throw new Error("CALL_POLICY_PLAN_ROUND_INVALID");

  if (objectionType === null) {
    return Object.freeze({ disposition: "ALLOW", ruleId: "CALL-PLAN-ALLOW", policyVersion: policy.version, policyHash, objectionType: null, reversible: true });
  }

  const disposition = policy.rules[objectionType];
  if (!disposition) throw new Error("CALL_POLICY_RULE_MISSING");
  if (planRound >= policy.maxPlanRounds && disposition !== "BLOCK") {
    return Object.freeze({ disposition: "ESCALATE", ruleId: "CALL-PLAN-ROUND-LIMIT", policyVersion: policy.version, policyHash, objectionType, reversible: false });
  }

  return Object.freeze({
    disposition,
    ruleId: `CALL-PLAN-${objectionType}`,
    policyVersion: policy.version,
    policyHash,
    objectionType,
    reversible: !["BLOCK", "ESCALATE"].includes(disposition),
  });
}

export function assertPolicyImmutable(previous: CallPolicy, next: CallPolicy): void {
  if (computePolicyHash(previous) !== computePolicyHash(next)) throw new Error("CALL_POLICY_REVISION_REQUIRES_ESCALATION");
}
