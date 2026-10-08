#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectGovernanceMetrics } from './agent-governance-metrics.mjs';

const CANONICAL_REPOSITORY = 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';
const CANONICAL_POLICY_VERSION = '1.4.1';
const SHA = /^[a-f0-9]{40}$/u;

export function evaluateAdmission(input) {
  const failures = [];
  if (input.repository !== CANONICAL_REPOSITORY) failures.push('repository:not-canonical');
  if (!SHA.test(input.targetSha || '')) failures.push('target-sha:invalid');
  if (!input.missionId) failures.push('mission-id:missing');
  if (input.policyVersion !== CANONICAL_POLICY_VERSION) failures.push('policy-version:not-canonical');
  if (input.scope !== 'EXECUTION') failures.push('scope:not-execution');
  if (input.workflowRun && input.targetSha !== input.workflowRun.headSha) failures.push('target-sha:not-workflow-head');
  if (input.dispatchRef && input.targetSha !== input.dispatchRef) failures.push('target-sha:not-dispatch-target');
  return { allow: failures.length === 0, failures };
}


async function runAdmissionGate() {
  function exactTargetSha() {
    if (process.env.GITHUB_EVENT_NAME === 'workflow_run') return process.env.WORKFLOW_RUN_HEAD_SHA || '';
    return process.env.TARGET_SHA || '';
  }
  
  const targetSha = exactTargetSha();
  const result = evaluateAdmission({
    repository: process.env.GITHUB_REPOSITORY || '',
    targetSha,
    missionId: process.env.MISSION_ID || '',
    policyVersion: process.env.POLICY_VERSION || CANONICAL_POLICY_VERSION,
    scope: 'EXECUTION',
    workflowRun: process.env.GITHUB_EVENT_NAME === 'workflow_run' ? { headSha: process.env.WORKFLOW_RUN_HEAD_SHA || '' } : null,
    dispatchRef: process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' ? process.env.TARGET_SHA || '' : null,
  });
  
  if (!result.allow) {
    console.error('ADMISSION=REJECT');
    for (const failure of result.failures) console.error(failure);
    process.exit(1);
  }
  
  try {
    execFileSync('git', ['cat-file', '-e', targetSha + '^{commit}'], { stdio: 'ignore' });
  } catch {
    console.error('ADMISSION=REJECT');
    console.error('target-sha:not-present-in-checkout');
    process.exit(1);
  }
  
  let telemetry;
  try {
    telemetry = await collectGovernanceMetrics({
      token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
      repo: process.env.GITHUB_REPOSITORY || '',
    });
  } catch (error) {
    console.error('ADMISSION=REJECT');
    console.error('governance-telemetry:unavailable');
    console.error(String(error?.message || error));
    process.exit(1);
  }
  if (telemetry.decision.downgraded) {
    console.error('ADMISSION=REJECT');
    for (const reason of telemetry.decision.reasons) console.error('automatic-downgrade:' + reason);
    process.exit(1);
  }
  
  const artifact = {
    admission: {
      decision: 'ALLOW',
      scope: 'EXECUTION',
      mission_id: process.env.MISSION_ID,
      target_sha: targetSha,
      policy_version: process.env.POLICY_VERSION || '1.4.1',
      gate_run_id: process.env.GITHUB_RUN_ID || '',
      parent_run_id: process.env.PARENT_RUN_ID || '',
      reason: 'ALL_ADMISSION_CHECKS_GREEN',
      governance_enforcement: telemetry.decision.enforcement,
      governance_sample_size: telemetry.metrics.window.sampleSize,
      governance_metrics: {
        build_success_rate: telemetry.metrics.buildSuccessRate,
        regressions: telemetry.metrics.regressions,
        rollback_rate: telemetry.metrics.rollbackRate,
        rejected_review_rate: telemetry.metrics.rejectedReviewRate,
      },
      timestamp: new Date().toISOString(),
    },
  };
  
  console.log('ADMISSION=ALLOW_EXECUTION');
  console.log(JSON.stringify(artifact, null, 2));
  
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await runAdmissionGate();
}
