export const CALL_POLICY_VERSION = "1.0.0" as const;

export const CALL_POLICY = Object.freeze({
  noObjectiveNoWork: true,
  opponentRequired: true,
  opponentIndependentStart: true,
  redTeamRequired: true,
  independentVerificationRequired: true,
  exactShaBinding: true,
  memoryAppendOnly: true,
  xpRequiresEvidence: true,
  reputationIsNotAuthority: true,
  budgetHardStop: true,
  mainDirectWrite: false,
  secondExecutor: false,
  secondDispatcher: false,
  policyNegotiationByAgents: false,
  maxRetries: 3,
  maxPlanRounds: 3,
} as const);

function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    const record=value as Record<string,unknown>;
    return "{" + Object.keys(record).sort().map(k=>JSON.stringify(k)+":"+canonical(record[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}

export function canonicalPolicyJson(): string {
  return canonical({version: CALL_POLICY_VERSION, policy: CALL_POLICY});
}

export async function computePolicyHash(): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalPolicyJson()));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
