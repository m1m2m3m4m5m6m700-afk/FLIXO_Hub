#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { reconcile, verify } from './patch-capsule.mjs';

const REPOSITORY = 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';
const BRANCH = 'execution';
const CONTROLLER = 'assistantController';
const SHA_RE = /^[0-9a-f]{40}$/;

function assertSha(value, label) {
  if (!SHA_RE.test(value ?? '')) throw new Error(`CONTROLLER_INVALID_${label.toUpperCase()}_SHA`);
}

function git(args, cwd = process.cwd()) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd();
}

function config() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const secret = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!url || !secret) throw new Error('CONTROLLER_SUPABASE_NOT_CONFIGURED');
  if (!token) throw new Error('CONTROLLER_GITHUB_TOKEN_NOT_CONFIGURED');
  return { url, secret, token };
}

async function supabase(path, init = {}) {
  const { url, secret } = config();
  const headers = new Headers(init.headers);
  headers.set('apikey', secret);
  headers.set('Authorization', `Bearer ${secret}`);
  headers.set('Accept', 'application/json');
  const response = await fetch(`${url}${path}`, { ...init, headers });
  const bodyText = await response.text();
  const body = bodyText ? (() => { try { return JSON.parse(bodyText); } catch { return bodyText; } })() : null;
  if (!response.ok) throw new Error(`CONTROLLER_SUPABASE_HTTP_${response.status}:${String(bodyText).slice(0,1000)}`);
  return body;
}

async function rpc(name, payload) {
  return supabase(`/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function getQueue(queueId) {
  if (!/^[0-9a-f-]{36}$/i.test(queueId ?? '')) throw new Error('CONTROLLER_QUEUE_ID_INVALID');
  const body = await supabase(
    `/rest/v1/flix_controller_push_queue?queue_id=eq.${encodeURIComponent(queueId)}&select=*&limit=1`,
  );
  if (!Array.isArray(body) || body.length !== 1) throw new Error('CONTROLLER_QUEUE_NOT_FOUND');
  const row = body[0];
  if (row.repository !== REPOSITORY || row.branch !== BRANCH) throw new Error('CONTROLLER_QUEUE_SCOPE_INVALID');
  verify({
    protocolVersion: 'FLIXO-PATCH-CAPSULE-v1',
    repository: row.repository,
    branch: row.branch,
    sourceSha: row.target_sha,
    parentSha: row.parent_sha,
    candidateSha: row.candidate_sha,
    patchSha256: row.patch_sha256,
    patchText: row.patch_text ?? '',
    paths: Array.isArray(row.paths) ? row.paths : [],
  });
  return row;
}

function refreshExecutionRef() {
  execFileSync('git', ['fetch', '--no-tags', 'origin', `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function liveHead() {
  const output = execFileSync('git', ['ls-remote', 'origin', `refs/heads/${BRANCH}`], { encoding: 'utf8' }).trim();
  const sha = output.split(/\s+/)[0] ?? '';
  assertSha(sha, 'live_head');
  return sha;
}

function stablePatchHash(patchText) {
  return createHash('sha256').update(patchText, 'utf8').digest('hex');
}

function assertControllerContext() {
  if (process.env.FLIXO_CANONICAL_CONTROLLER !== CONTROLLER) {
    throw new Error('CONTROLLER_CANONICAL_IDENTITY_REQUIRED');
  }
  if (process.env.GITHUB_ACTIONS !== 'true') {
    throw new Error('CONTROLLER_GITHUB_ACTIONS_REQUIRED');
  }
  if ((process.env.FLIXO_TARGET_BRANCH ?? '') !== BRANCH) {
    throw new Error('CONTROLLER_EXECUTION_TARGET_REQUIRED');
  }
}

async function reconcileQueue(queueId, worktree) {
  const row = await getQueue(queueId);
  const currentBeforeReconcile = await liveHead();

  // Crash recovery: ACCEPTED + exact candidate at live head means the push succeeded
  // but consolidation bookkeeping did not. Finalize the durable record without
  // reapplying the patch.
  if (row.status === 'ACCEPTED' && currentBeforeReconcile === row.candidate_sha) {
    await rpc('flix_controller_push_queue_mark_consolidated', {
      p_queue_ids: [queueId],
      p_controller_agent: CONTROLLER,
      p_current_sha: currentBeforeReconcile,
      p_consolidated_commit_sha: row.candidate_sha,
    });
    return {
      row,
      current: currentBeforeReconcile,
      recoveredPublication: true,
      result: {
        paths: Array.isArray(row.paths) ? row.paths : [],
        patchText: row.reconciled_patch_text ?? row.patch_text ?? '',
        patchSha256: row.reconciled_patch_sha256 ?? row.patch_sha256,
        status: 'ALREADY_PUBLISHED_RECOVERY',
      },
    };
  }

  refreshExecutionRef();
  const current = await liveHead();
  const capsule = {
    protocolVersion: 'FLIXO-PATCH-CAPSULE-v1',
    repository: row.repository,
    branch: row.branch,
    sourceSha: row.target_sha,
    parentSha: row.parent_sha,
    candidateSha: row.candidate_sha,
    patchSha256: row.reconciled_patch_sha256 ?? row.patch_sha256,
    patchText: row.reconciled_patch_text ?? row.patch_text ?? '',
    paths: Array.isArray(row.paths) ? row.paths : [],
    taskId: row.task_id,
    workPackageId: row.work_package_id,
  };
  verify(capsule);

  mkdirSync(worktree, { recursive: true });
  git(['worktree', 'add', '--detach', worktree, current]);
  try {
    const result = reconcile({ capsule, targetSha: current, cwd: worktree, preserveWorktree: true });
    return { row, current, result };
  } catch (error) {
    await rpc('flix_controller_push_queue_mark_conflict', {
      p_queue_id: queueId,
      p_controller_agent: CONTROLLER,
      p_current_sha: current,
      p_reason: String(error?.message ?? error).slice(0, 1800),
    }).catch(() => {});
    throw error;
  }
}

async function persistReconciliation(queueId, row, current, result, candidateSha) {
  if (stablePatchHash(result.patchText) !== result.patchSha256) {
    throw new Error('CONTROLLER_RECONCILED_PATCH_HASH_MISMATCH');
  }
  const validationReport = {
    authority: 'VALIDATION_ONLY',
    validationStatus: 'PASS',
    candidateParentSha: current,
    liveExecutionSha: current,
    sourceSha: row.target_sha,
    originalCandidateSha: row.candidate_sha,
    patchSha256: result.patchSha256,
    originalPatchSha256: row.patch_sha256,
    paths: result.paths,
    decision: null,
    candidateSha,
  };
  await rpc('flix_controller_push_queue_reconcile', {
    p_queue_id: queueId,
    p_controller_agent: CONTROLLER,
    p_current_sha: current,
    p_reconciled_candidate_sha: candidateSha,
    p_reconciled_patch_sha256: result.patchSha256,
    p_reconciled_patch_text: result.patchText,
    p_validation_report: validationReport,
    p_reconciled_from_sha: row.target_sha,
  });
  return validationReport;
}

function verifyWorktree(worktree) {
  git(['diff', '--check'], worktree);
  execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: worktree, encoding: 'utf8', stdio: 'inherit' });
  execFileSync('npm', ['test'], { cwd: worktree, encoding: 'utf8', stdio: 'inherit' });
  execFileSync('npm', ['run', 'build'], { cwd: worktree, encoding: 'utf8', stdio: 'inherit' });
}

function createCandidateCommit(worktree, targetSha, message, allowedPaths) {
  const statusLines = git(['status', '--short'], worktree).split('\n').filter(Boolean);
  if (statusLines.length === 0) throw new Error('CONTROLLER_NO_RECONCILED_CHANGES');
  const allowed = new Set(allowedPaths);
  if (!allowed.size) throw new Error('CONTROLLER_ALLOWED_PATHS_EMPTY');
  for (const line of statusLines) {
    const path = line.slice(3).trim().replace(/^"|"$/g, '');
    if (!allowed.has(path)) throw new Error('CONTROLLER_OUT_OF_SCOPE_CHANGE:' + path);
  }
  git(['add', '--', ...[...allowed]], worktree);
  const staged = git(['diff', '--cached', '--name-only'], worktree);
  if (!staged) throw new Error('CONTROLLER_EMPTY_STAGED_DIFF');
  const commitMessage = message?.trim() || 'repair(controller): reconcile patch capsule';
  git(['commit', '-m', commitMessage], worktree);
  const candidateSha = git(['rev-parse', 'HEAD'], worktree);
  const parentSha = git(['rev-parse', 'HEAD^'], worktree);
  if (parentSha !== targetSha) {
    throw new Error('CONTROLLER_PARENT_MISMATCH:' + parentSha + '!=' + targetSha);
  }
  return { candidateSha, parentSha, staged };
}

async function acceptCandidate(queueId, currentSha, validationReport) {
  if (!validationReport || validationReport.validationStatus !== 'PASS' || validationReport.decision !== null) {
    throw new Error('CONTROLLER_ACCEPT_REQUIRES_VALIDATION_ONLY');
  }
  return rpc('flix_controller_push_queue_controller_decide', {
    p_queue_id: queueId,
    p_controller_agent: CONTROLLER,
    p_decision: 'ACCEPTED',
    p_reason: 'Exact current execution head validated by canonical controller.',
    p_current_sha: currentSha,
    p_validation_report: validationReport,
  });
}

async function publish(queueId, worktree, targetSha, candidateSha) {
  const before = await liveHead();
  if (before !== targetSha) {
    throw new Error('CONTROLLER_CAS_CONFLICT:' + before + '!=' + targetSha);
  }
  const localHead = git(['rev-parse', 'HEAD'], worktree);
  if (localHead !== candidateSha) throw new Error('CONTROLLER_CANDIDATE_HEAD_MISMATCH:' + localHead + '!=' + candidateSha);
  const parent = git(['rev-parse', 'HEAD^'], worktree);
  if (parent !== targetSha) throw new Error('CONTROLLER_PARENT_MISMATCH:' + parent + '!=' + targetSha);

  try {
    execFileSync('git', ['push', '--porcelain', 'origin', 'HEAD:refs/heads/' + BRANCH], {
      cwd: worktree,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const detail = String(error?.stderr ?? error?.message ?? error).slice(0, 2000);
    const now = await liveHead().catch(() => '');
    throw new Error('CONTROLLER_CAS_PUSH_CONFLICT:' + (now || 'UNKNOWN') + ':' + detail, { cause: error });
  }

  const after = await liveHead();
  if (after !== candidateSha) throw new Error('CONTROLLER_POST_PUSH_HEAD_MISMATCH:' + after + '!=' + candidateSha);

  await rpc('flix_controller_push_queue_mark_consolidated', {
    p_queue_ids: [queueId],
    p_controller_agent: CONTROLLER,
    p_current_sha: targetSha,
    p_consolidated_commit_sha: candidateSha,
  });

  return { candidateSha, parentSha: parent, liveSha: after };
}

async function main() {
  assertControllerContext();
  const queueId = arg('--queue-id');
  if (!queueId) throw new Error('CONTROLLER_QUEUE_ID_REQUIRED');

  const root = process.env.RUNNER_TEMP ? join(process.env.RUNNER_TEMP, `flixo-controller-${queueId}`) : join(process.cwd(), `.flixo-controller-${queueId}`);
  const worktree = join(root, 'worktree');
  const output = arg('--out');
  const message = arg('--message');

  try {
    const { row, current, result, recoveredPublication } = await reconcileQueue(queueId, worktree);

    if (recoveredPublication) {
      const record = {
        protocolVersion: 'FLIXO-PATCH-CAPSULE-v1',
        queueId,
        sourceSha: row.target_sha,
        targetSha: current,
        recovery: 'ALREADY_PUBLISHED_RECOVERY',
        publication: { candidateSha: row.candidate_sha, parentSha: row.parent_sha, liveSha: current },
      };
      if (output) await writeFile(output, JSON.stringify(record, null, 2) + '\n', 'utf8');
      console.log(JSON.stringify(record, null, 2));
      return;
    }

    verifyWorktree(worktree);
    const candidateCommit = createCandidateCommit(
      worktree,
      current,
      message,
      result.paths.length ? result.paths : row.paths,
    );
    const beforePersist = await liveHead();
    if (beforePersist !== current) {
      throw new Error(`CONTROLLER_CAS_CONFLICT_BEFORE_PERSIST:${beforePersist}!=${current}`);
    }
    const validation = await persistReconciliation(queueId, row, current, result, candidateCommit.candidateSha);
    await acceptCandidate(queueId, current, validation);

    let publication;
    try {
      publication = await publish(queueId, worktree, current, candidateCommit.candidateSha);
    } catch (error) {
      const reason = String(error?.message ?? error).slice(0, 1800);
      if (/CONTROLLER_CAS_(?:CONFLICT|PUSH_CONFLICT)/.test(reason)) {
        const movedHead = await liveHead().catch(() => current);
        await rpc('flix_controller_push_queue_mark_conflict', {
          p_queue_id: queueId,
          p_controller_agent: CONTROLLER,
          p_current_sha: movedHead,
          p_reason: reason,
        }).catch(() => {});
      }
      throw error;
    }
    const record = { protocolVersion: 'FLIXO-PATCH-CAPSULE-v1', queueId, sourceSha: row.target_sha, targetSha: current, validation, publication };
    if (output) await writeFile(output, JSON.stringify(record, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(record, null, 2));
  } finally {
    try { git(['worktree', 'remove', '--force', worktree]); } catch { /* best-effort worktree cleanup */ }
    try { await rm(root, { recursive: true, force: true }); } catch { /* best-effort temp cleanup */ }
  }
}

function arg(flag) {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
}

if (import.meta.url === new URL(`file://${process.argv[1] ?? ''}`).href) {
  main().catch((error) => {
    console.error(String(error?.message ?? error));
    process.exit(1);
  });
}

export { getQueue, liveHead, reconcileQueue, persistReconciliation, publish, assertControllerContext };
