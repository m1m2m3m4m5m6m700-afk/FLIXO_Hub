import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  requireBearerToken,
  validateGitHubOidcClaims,
} from '../supabase/functions/_shared/council-oidc.ts';

const repo = 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';
const masterWorkflow = 'FLIXO Master Agent Activation Relay';
const trustedSha = '0123456789abcdef0123456789abcdef01234567';
const config = {
  repository: repo,
  allowedWorkflows: [masterWorkflow],
  trustedWorkflowSha: trustedSha,
  externalLeaseWatcherWorkflow: 'FLIXO External Council Lease Watcher',
  externalLeaseWatcherRef: repo + '/.github/workflows/council-external-lease-watch.yml@refs/heads/main',
} as const;

const baseClaims = {
  repository: repo,
  workflow: masterWorkflow,
  workflow_sha: trustedSha,
  job_workflow_ref: repo + '/.github/workflows/agent-master-activation.yml@refs/heads/main',
  job_workflow_sha: trustedSha,
  event_name: 'workflow_run',
  ref: 'refs/heads/execution',
};

test('missing and malformed bearer tokens fail closed', () => {
  assert.throws(() => requireBearerToken(null), /COUNCIL_GITHUB_OIDC_MISSING/);
  assert.throws(() => requireBearerToken('Bearer invalid'), /COUNCIL_GITHUB_OIDC_INVALID/);
});

test('repository claim mismatch is rejected', () => {
  assert.throws(
    () => validateGitHubOidcClaims({ ...baseClaims, repository: 'attacker/repo' }, config),
    /COUNCIL_GITHUB_OIDC_REPOSITORY_REJECTED/,
  );
});

test('workflow claim mismatch is rejected', () => {
  assert.throws(
    () => validateGitHubOidcClaims({ ...baseClaims, workflow: 'attacker-workflow' }, config),
    /COUNCIL_GITHUB_OIDC_WORKFLOW_REJECTED/,
  );
});

test('workflow SHA missing, invalid, and mismatched values are rejected', () => {
  assert.throws(
    () => validateGitHubOidcClaims({ ...baseClaims, workflow_sha: '' }, config),
    /COUNCIL_GITHUB_OIDC_WORKFLOW_SHA_MISSING/,
  );
  assert.throws(
    () => validateGitHubOidcClaims({ ...baseClaims, workflow_sha: 'not-a-sha' }, config),
    /COUNCIL_GITHUB_OIDC_WORKFLOW_SHA_MISSING/,
  );
  assert.throws(
    () => validateGitHubOidcClaims({
      ...baseClaims,
      workflow_sha: 'fedcba9876543210fedcba9876543210fedcba98',
    }, config),
    /COUNCIL_GITHUB_OIDC_WORKFLOW_SHA_REJECTED/,
  );
});

test('job workflow SHA missing, invalid, and mismatched values are rejected', () => {
  assert.throws(
    () => validateGitHubOidcClaims({ ...baseClaims, job_workflow_sha: '' }, config),
    /COUNCIL_GITHUB_OIDC_JOB_WORKFLOW_SHA_MISSING/,
  );
  assert.throws(
    () => validateGitHubOidcClaims({
      ...baseClaims,
      job_workflow_sha: 'not-a-sha',
    }, config),
    /COUNCIL_GITHUB_OIDC_JOB_WORKFLOW_SHA_MISSING/,
  );
  assert.throws(
    () => validateGitHubOidcClaims({
      ...baseClaims,
      job_workflow_sha: 'fedcba9876543210fedcba98fedcba9876543210',
    }, config),
    /COUNCIL_GITHUB_OIDC_JOB_WORKFLOW_SHA_REJECTED/,
  );
});

test('job workflow reference and event/ref context are fail-closed', () => {
  assert.throws(
    () => validateGitHubOidcClaims({
      ...baseClaims,
      job_workflow_ref: repo + '/.github/workflows/attacker.yml@refs/heads/main',
    }, config),
    /COUNCIL_GITHUB_OIDC_CONTEXT_REJECTED/,
  );
  assert.throws(
    () => validateGitHubOidcClaims({ ...baseClaims, event_name: 'push' }, config),
    /COUNCIL_GITHUB_OIDC_CONTEXT_REJECTED/,
  );
  assert.throws(
    () => validateGitHubOidcClaims({ ...baseClaims, ref: 'refs/heads/main' }, config),
    /COUNCIL_GITHUB_OIDC_CONTEXT_REJECTED/,
  );
});

test('valid trusted workflow claims are accepted', () => {
  const result = validateGitHubOidcClaims(baseClaims, config);
  assert.equal(result.repository, repo);
  assert.equal(result.workflow_sha, trustedSha);
});

test('external watcher requires the canonical main workflow reference and matching job SHA', () => {
  const externalConfig = {
    ...config,
    allowedWorkflows: ['FLIXO External Council Lease Watcher'],
    trustedWorkflowSha: null,
  } as const;
  const valid = {
    repository: repo,
    workflow: externalConfig.allowedWorkflows[0],
    workflow_sha: trustedSha,
    job_workflow_ref: externalConfig.externalLeaseWatcherRef,
    job_workflow_sha: trustedSha,
    event_name: 'schedule',
    ref: 'refs/heads/main',
  };
  assert.doesNotThrow(() => validateGitHubOidcClaims(valid, externalConfig));
  assert.throws(
    () => validateGitHubOidcClaims({ ...valid, job_workflow_ref: repo + '/.github/workflows/attacker.yml@refs/heads/main' }, externalConfig),
    /COUNCIL_EXTERNAL_WATCHER_MAIN_REF_REJECTED/,
  );
  assert.throws(
    () => validateGitHubOidcClaims({ ...valid, job_workflow_sha: 'fedcba9876543210fedcba98fedcba9876543210' }, externalConfig),
    /COUNCIL_EXTERNAL_WATCHER_WORKFLOW_SHA_MISMATCH/,
  );
});

test('edge source and config retain explicit custom OIDC boundary', async () => {
  const source = await readFile('supabase/functions/flixo-council-runtime/index.ts', 'utf8');
  const config = await readFile('supabase/config.toml', 'utf8');
  assert.match(source, /GITHUB_OIDC_ISSUER = "https:\/\/token\.actions\.githubusercontent\.com"/u);
  assert.match(source, /jwtVerify\(token, GITHUB_OIDC_JWKS, \{[\s\S]*issuer: GITHUB_OIDC_ISSUER,[\s\S]*audience: GITHUB_OIDC_AUDIENCE/u);
  assert.match(source, /const token = requireBearerToken\(req\.headers\.get\("authorization"\)\)/u);
  assert.match(source, /function constantTimeEqual[\s\S]*timingSafeEqual/u);
  assert.match(source, /constantTimeEqual\(token, expected\)/u);
  assert.match(config, /\[functions\.flixo-council-runtime\][\s\S]*verify_jwt = false/u);
  assert.doesNotMatch(source, /if \(!token\)\s*return true/u);
});
