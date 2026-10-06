#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const QUARANTINED_REFS = new Set([
  // Observed legacy/unapproved agent refs retained only as historical evidence until deletion is available.
  'refs/heads/agent-2-media-engines-20261006',
  'refs/heads/agent-3a/redteam-rt17-20261006',
  'refs/heads/agent-3b/redteam-rt19-20261006',
  'refs/heads/agent-3c/redteam-rt20-20261006',
  'refs/heads/agent-residual/redteam-closure-20261006',
]);

const PRODUCTION_REF = 'refs/heads/main';
const INTEGRATION_REF = 'refs/heads/execution';

const CONTROLLED_AGENT_REF = /^refs\/heads\/(?:agent-(?:1|2|3|4)|agent(?:1|2|3|4))\//u;
const PRODUCTION_DEPLOYMENT_COMMAND =
  /\b(?:wrangler|vercel|supabase|flyctl|kubectl|terraform)\s+(?:deploy|apply|push|publish)\b|\b(?:npm|pnpm|yarn)\s+publish\b/iu;

const MAIN_REF_MUTATION =
  /\b(?:git\s+push[^\n]*(?:refs\/heads\/main\b|\bmain\b)|git\s+update-ref[^\n]*(?:refs\/heads\/main\b|\bmain\b)|gh\s+api[^\n]*git\/refs\/heads\/main\b)/iu;

const PRODUCTION_DEPLOYMENT_ACTION =
  /(^|\n)\s*-?\s*uses:\s*(?:cloudflare\/wrangler-action|actions\/deploy-pages|JamesIves\/github-pages-deploy-action|amondnet\/vercel-action|vercel\/[^\s@]+)@/imu;

export function classifyRef(ref) {
  if (ref === PRODUCTION_REF) {
    return { authority: 'production', allowed: true, quarantined: false };
  }
  if (ref === INTEGRATION_REF) {
    return { authority: 'integration', allowed: true, quarantined: false };
  }
  if (CONTROLLED_AGENT_REF.test(ref)) {
    return { authority: 'controlled-agent', allowed: true, quarantined: false };
  }
  if (QUARANTINED_REFS.has(ref)) {
    return { authority: 'quarantined-stale', allowed: true, quarantined: true };
  }
  return { authority: 'unknown', allowed: false, quarantined: false };
}

export function parseRemoteRefs(lsRemoteOutput) {
  return lsRemoteOutput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/u)[1])
    .filter((ref) => ref && ref.startsWith('refs/heads/'));
}

function jobBlocks(workflow) {
  const lines = workflow.split('\n');
  const start = lines.findIndex((line) => /^jobs:\s*$/u.test(line));
  if (start < 0) return [];

  const jobs = [];
  let current = null;

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\S/u.test(line)) {
      if (current) jobs.push(current);
      break;
    }

    const jobMatch = /^\x20{2}([A-Za-z0-9_.-]+):\s*$/u.exec(line);
    if (jobMatch) {
      if (current) jobs.push(current);
      current = { id: jobMatch[1], lines: [] };
      continue;
    }

    if (current) current.lines.push(line);
  }

  if (current) jobs.push(current);
  return jobs;
}

function hasMainPushGate(jobText) {
  const compact = jobText.replace(/\s+/gu, ' ');
  return (
    /github\.event_name\s*==\s*['"]push['"]/u.test(compact) &&
    /github\.ref\s*==\s*['"]refs\/heads\/main['"]/u.test(compact)
  );
}

function hasMainOnlyPushTrigger(workflow) {
  const lines = workflow.split('\n');
  let inOn = false;
  let inPush = false;
  let triggerCount = 0;
  let mainPush = false;

  for (const line of lines) {
    if (/^on:\s*$/u.test(line)) {
      inOn = true;
      continue;
    }
    if (inOn && /^\S/u.test(line)) break;
    if (!inOn) continue;

    const triggerMatch = /^\x20{2}([A-Za-z0-9_-]+):\s*$/u.exec(line);
    if (triggerMatch) {
      inPush = triggerMatch[1] === 'push';
      triggerCount += 1;
      continue;
    }
    if (inPush && /^\x20{4}branches:\s*\[\s*main\s*\]\s*$/u.test(line)) {
      mainPush = true;
    }
  }

  return triggerCount === 1 && mainPush;
}
export function analyzeWorkflowAuthority(path, workflow) {
  const findings = [];
  const jobs = jobBlocks(workflow);
  const workflowContentsWrite = hasTopLevelContentsWrite(workflow);
  const workflowMainOnlyPush = hasMainOnlyPushTrigger(workflow);

  if (workflowContentsWrite && jobs.length === 0) {
    findings.push(`${path}: top-level contents:write has no job boundary to constrain mutation authority.`);
  }

  for (const job of jobs) {
    const jobText = job.lines.join('\n');
    const mainPushGate = hasMainPushGate(jobText);
    const executionTarget =
      /FLIXO_TARGET_BRANCH:\s*execution\b/u.test(jobText) &&
      /\bref:\s*execution\b/u.test(jobText);

    if (
      (PRODUCTION_DEPLOYMENT_COMMAND.test(jobText) || PRODUCTION_DEPLOYMENT_ACTION.test(jobText)) &&
      !mainPushGate
    ) {
      findings.push(
        `${path}#${job.id}: production/deployment authority is not gated to a push of refs/heads/main.`,
      );
    }

    if (MAIN_REF_MUTATION.test(jobText) && !mainPushGate) {
      findings.push(
        `${path}#${job.id}: direct main ref mutation is not gated to a push of refs/heads/main.`,
      );
    }

    const jobContentsWrite = /contents:\s*write\b/iu.test(jobText);
    if (jobContentsWrite || workflowContentsWrite) {
      const safeMainWrite = mainPushGate || workflowMainOnlyPush;
      const safeExecutionWrite = executionTarget;
      if (!safeMainWrite && !safeExecutionWrite) {
        findings.push(
          `${path}#${job.id}: contents:write has neither an explicit main-push gate nor an execution-only mutation target.`,
        );
      }
    }
  }

  return {
    pass: findings.length === 0,
    findings,
    jobs: jobs.map((job) => job.id),
  };
}

export function analyzeWorkflowSet(workflows) {
  const findings = [];
  const reports = [];

  for (const workflow of workflows) {
    const report = analyzeWorkflowAuthority(workflow.path, workflow.content);
    reports.push(report);
    findings.push(...report.findings);
  }

  return { pass: findings.length === 0, findings, reports };
}

function hasTopLevelContentsWrite(workflow) {
  const lines = workflow.split('\n');
  let inPermissions = false;

  for (const line of lines) {
    if (/^permissions:\s*$/u.test(line)) {
      inPermissions = true;
      continue;
    }
    if (inPermissions && /^\S/u.test(line)) {
      inPermissions = false;
    }
    if (!inPermissions) {
      if (/^permissions:\s*(?:write-all|\{[^}]*contents:\s*write)/iu.test(line)) return true;
      continue;
    }
    if (/^\s{2}contents:\s*write\s*$/iu.test(line)) return true;
  }

  return false;
}

function loadWorkflowSet() {
  const directory = '.github/workflows';
  return readdirSync(directory)
    .filter((name) => /\.ya?ml$/iu.test(name))
    .sort()
    .map((name) => ({ path: join(directory, name), content: readFileSync(join(directory, name), 'utf8') }));
}

export function verifyBranchPolicy({ remote = 'origin' } = {}) {
  const remoteRefs = parseRemoteRefs(
    execFileSync('git', ['ls-remote', '--heads', remote], { encoding: 'utf8' }),
  );

  const classifications = remoteRefs.map((ref) => ({ ref, ...classifyRef(ref) }));
  const unexpected = classifications.filter((entry) => !entry.allowed);
  const quarantined = classifications.filter((entry) => entry.quarantined);

  const workflowReport = analyzeWorkflowSet(loadWorkflowSet());

  if (unexpected.length > 0 || !workflowReport.pass) {
    console.error('BRANCH_POLICY=FAIL');
    if (unexpected.length > 0) {
      console.error('Unknown refs:');
      console.error(unexpected.map((entry) => entry.ref).join('\n'));
    }
    if (!workflowReport.pass) {
      console.error('Unauthorized workflow authority:');
      console.error(workflowReport.findings.join('\n'));
    }
    process.exitCode = 1;
    return { pass: false, classifications, unexpected, quarantined, workflowReport };
  }

  for (const entry of quarantined) {
    console.warn(`BRANCH_POLICY=QUARANTINED ${entry.ref}`);
  }

  console.log('BRANCH_POLICY=PASS');
  return { pass: true, classifications, unexpected, quarantined, workflowReport };
}

const executedDirectly =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (executedDirectly) {
  verifyBranchPolicy();
}
