export const OPERATIONAL_REFS = new Set([
  'refs/heads/main',
  'refs/heads/execution',
]);

// Agent coordination branches are explicitly untrusted for production.
// Compatibility prefixes must be classified without becoming deploy authority.
// The temporary residual remediation lane is also explicitly classified as
// controlled/untrusted; it never receives production authority.
export const CONTROLLED_AGENT_REF = /^refs\/heads\/(?:agent-(?:1|2|3|4)\/|agent-3[abc]\/|agent3\/|agent-residual\/)/u;

export const STALE_REFS = new Set([
  'refs/heads/agent-2-media-engines-20261006',
]);

// No historical branch is currently present in the live remote inventory.
// Known historical refs must be added here explicitly rather than inferred.
export const HISTORICAL_REFS = new Set();

export function classifyBranchRef(ref) {
  if (OPERATIONAL_REFS.has(ref)) return 'operational';
  if (STALE_REFS.has(ref)) return 'stale';
  if (HISTORICAL_REFS.has(ref)) return 'historical';
  if (CONTROLLED_AGENT_REF.test(ref)) return 'controlled agent';
  return 'unknown';
}

export function enumerateWorkflowAuthority(workflowFiles) {
  return workflowFiles.map(({ path, source }) => {
    const productionDeploy =
      /production-deploy/u.test(source) ||
      /environment:\s*production\b/iu.test(source) ||
      /wrangler-action@[^\s]+[\s\S]{0,1200}?\bcommand:\s*deploy\b/iu.test(source) ||
      /\bvercel\b[\s\S]{0,500}?--prod\b/iu.test(source);

    const promotion =
      /\bpromotion(?:-proof)?\b/iu.test(source) ||
      /\bpromote\b/iu.test(source);

    return {
      path,
      authoritySensitive: productionDeploy || promotion,
      productionDeploy,
      promotion,
    };
  });
}

export function assertWorkflowAuthority(inventory) {
  for (const entry of inventory) {
    if (!entry.authoritySensitive) continue;

    const source = entry.source;
    if (entry.productionDeploy) {
      if (!/github\.event_name\s*==\s*['"]push['"][\s\S]{0,120}?github\.ref\s*==\s*['"]refs\/heads\/main['"]/u.test(source)) {
        throw new Error('PRODUCTION_WORKFLOW_NOT_MAIN_ONLY:' + entry.path);
      }
      if (/refs\/heads\/agent-(?:1|2|3|4|3a|3b|3c)\//u.test(source)) {
        throw new Error('AGENT_REF_HAS_PRODUCTION_AUTHORITY:' + entry.path);
      }
      if (/refs\/heads\/agent3\//u.test(source)) {
        throw new Error('AGENT3_REF_HAS_PRODUCTION_AUTHORITY:' + entry.path);
      }
    }

    if (entry.promotion) {
      if (!/BASE_BRANCH[^\n]+main/u.test(source) || !/HEAD_BRANCH[^\n]+execution/u.test(source)) {
        throw new Error('PROMOTION_WORKFLOW_NOT_EXECUTION_TO_MAIN:' + entry.path);
      }
      if (/HEAD_BRANCH[^\n]+agent-(?:1|2|3|4|3a|3b|3c)\//u.test(source)) {
        throw new Error('AGENT_REF_HAS_PROMOTION_AUTHORITY:' + entry.path);
      }
    }
  }

  return inventory;
}
