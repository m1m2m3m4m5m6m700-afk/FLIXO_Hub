export const CALL_RED_TEAM_VERSION = "1.0.0" as const;

export type RedTeamTrigger = "PLAN" | "MILESTONE" | "CANDIDATE";
export type RedTeamPolicy = Readonly<{
  trigger: RedTeamTrigger;
  required: boolean;
  independentProvider: boolean;
  attackSurfaces: readonly string[];
  minimumFindings: number;
  failClosed: boolean;
}>;

export function validateRedTeamPolicy(policy: RedTeamPolicy): void {
  if (!policy.attackSurfaces.length || policy.minimumFindings < 0) throw new Error("RED_TEAM_POLICY_INVALID");
  if (policy.required && !policy.independentProvider) throw new Error("RED_TEAM_INDEPENDENCE_REQUIRED");
  if (!policy.failClosed) throw new Error("RED_TEAM_FAIL_OPEN");
}
