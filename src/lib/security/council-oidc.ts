export type GitHubOidcClaims = Record<string, unknown>;

export type GitHubOidcValidationConfig = {
  repository: string;
  allowedWorkflows: readonly string[];
  trustedWorkflowSha: string | null;
  externalLeaseWatcherWorkflow: string;
  externalLeaseWatcherRef: string;
};

const HEX_SHA40 = /^[0-9a-f]{40}$/u;
const BEARER_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;

export const requireBearerToken = (authorization: string | null | undefined): string => {
  const value = String(authorization ?? "").trim();
  if (!value.startsWith("Bearer ")) throw new Error("COUNCIL_GITHUB_OIDC_MISSING");
  const token = value.slice("Bearer ".length).trim();
  if (!BEARER_TOKEN.test(token)) throw new Error("COUNCIL_GITHUB_OIDC_INVALID");
  return token;
};

export const validateGitHubOidcClaims = (
  claims: GitHubOidcClaims,
  config: GitHubOidcValidationConfig,
): GitHubOidcClaims => {
  if (String(claims.repository ?? "") !== config.repository) {
    throw new Error("COUNCIL_GITHUB_OIDC_REPOSITORY_REJECTED");
  }

  const workflow = String(claims.workflow ?? "");
  if (!config.allowedWorkflows.includes(workflow)) {
    throw new Error("COUNCIL_GITHUB_OIDC_WORKFLOW_REJECTED");
  }

  const workflowSha = String(claims.workflow_sha ?? "").trim().toLowerCase();
  if (!HEX_SHA40.test(workflowSha)) {
    throw new Error("COUNCIL_GITHUB_OIDC_WORKFLOW_SHA_MISSING");
  }

  const jobWorkflowRef = String(claims.job_workflow_ref ?? "").trim();
  const jobWorkflowSha = String(claims.job_workflow_sha ?? "").trim().toLowerCase();
  if (jobWorkflowRef && !HEX_SHA40.test(jobWorkflowSha)) {
    throw new Error("COUNCIL_GITHUB_OIDC_JOB_WORKFLOW_SHA_MISSING");
  }

  if (config.trustedWorkflowSha) {
    if (workflowSha !== config.trustedWorkflowSha) {
      throw new Error("COUNCIL_GITHUB_OIDC_WORKFLOW_SHA_REJECTED");
    }
    if (jobWorkflowRef && jobWorkflowSha !== config.trustedWorkflowSha) {
      throw new Error("COUNCIL_GITHUB_OIDC_JOB_WORKFLOW_SHA_REJECTED");
    }
  } else if (workflow === config.externalLeaseWatcherWorkflow) {
    if (jobWorkflowRef !== config.externalLeaseWatcherRef) {
      throw new Error("COUNCIL_EXTERNAL_WATCHER_MAIN_REF_REJECTED");
    }
    if (!jobWorkflowSha || jobWorkflowSha !== workflowSha) {
      throw new Error("COUNCIL_EXTERNAL_WATCHER_WORKFLOW_SHA_MISMATCH");
    }
  } else {
    throw new Error("COUNCIL_TRUSTED_WORKFLOW_SHA_MISSING=" + workflow);
  }

  const event = String(claims.event_name ?? "");
  const ref = String(claims.ref ?? "");
  const allowed = config.allowedWorkflows.some((candidate) => {
    if (candidate === "FLIXO Master Agent Activation Relay") {
      return (
        event === "workflow_run"
        && ref === "refs/heads/execution"
        && String(claims.job_workflow_ref ?? "").startsWith(
          config.repository + "/.github/workflows/agent-master-activation.yml@",
        )
      );
    }
    if (candidate === config.externalLeaseWatcherWorkflow) {
      const expectedRef = String(claims.job_workflow_ref ?? "");
      if (event === "schedule") return ref === "refs/heads/main" && expectedRef === config.externalLeaseWatcherRef;
      if (event === "workflow_dispatch") return ref === "refs/heads/main" && expectedRef === config.externalLeaseWatcherRef;
      return false;
    }
    if (candidate === "FLIXO Council Wake Push Relay") {
      return (
        event === "push"
        && ref === "refs/heads/execution"
        && String(claims.job_workflow_ref ?? "").startsWith(
          config.repository + "/.github/workflows/council-wake-push-relay.yml@",
        )
      );
    }
    if (candidate === "FLIXO Agent Communication Relay") {
      return (
        event === "issue_comment"
        && ref === "refs/heads/main"
        && String(claims.job_workflow_ref ?? "").startsWith(
          config.repository + "/.github/workflows/agent-communication-relay.yml@",
        )
      );
    }
    if (candidate === "FLIXO Cell Master Consult Relay") {
      return (
        event === "workflow_dispatch"
        && (ref === "refs/heads/execution" || ref === "refs/heads/main")
        && String(claims.job_workflow_ref ?? "").startsWith(
          config.repository + "/.github/workflows/cell-master-consult.yml@",
        )
      );
    }
    return false;
  });

  if (!allowed) throw new Error("COUNCIL_GITHUB_OIDC_CONTEXT_REJECTED");
  return claims;
};
