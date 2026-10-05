#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const REPOSITORY = 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';
const BRANCH = 'execution';
const PROTOCOL = 'FLIXO-PATCH-CAPSULE-v1';
const SHA_RE = /^[0-9a-f]{40}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const MAX_PATCH_BYTES = 2_000_000;

function runGit(args, cwd = process.cwd()) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

function assertSha(value, label) {
  if (!SHA_RE.test(value ?? '')) throw new Error(`PATCH_CAPSULE_INVALID_${label.toUpperCase()}_SHA`);
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function parentSha(candidateSha, cwd) {
  const parents = runGit(['rev-list', '--parents', '-n', '1', candidateSha], cwd).split(/\s+/).slice(1);
  if (parents.length !== 1) throw new Error('PATCH_CAPSULE_CANDIDATE_MUST_HAVE_ONE_PARENT');
  return parents[0];
}

function capture({ sourceSha, candidateSha, cwd = process.cwd(), taskId = null, workPackageId = null }) {
  assertSha(sourceSha, 'source');
  assertSha(candidateSha, 'candidate');
  const actualParent = parentSha(candidateSha, cwd);
  if (actualParent !== sourceSha) {
    throw new Error(`PATCH_CAPSULE_PARENT_MISMATCH:${actualParent}!=${sourceSha}`);
  }

  const patchText = runGit(['diff', '--binary', '--full-index', sourceSha, candidateSha, '--'], cwd);
  const names = runGit(['diff', '--name-only', sourceSha, candidateSha, '--'], cwd);
  const paths = names ? names.split('\n').filter(Boolean) : [];
  const capsule = {
    protocolVersion: PROTOCOL,
    repository: REPOSITORY,
    branch: BRANCH,
    sourceSha,
    parentSha: sourceSha,
    candidateSha,
    patchSha256: sha256(patchText),
    patchText,
    paths,
    taskId,
    workPackageId,
    createdAt: new Date().toISOString(),
  };
  verify(capsule);
  return capsule;
}

function verify(capsule) {
  if (!capsule || typeof capsule !== 'object') throw new Error('PATCH_CAPSULE_NOT_OBJECT');
  if (capsule.protocolVersion !== PROTOCOL) throw new Error('PATCH_CAPSULE_PROTOCOL_MISMATCH');
  if (capsule.repository !== REPOSITORY) throw new Error('PATCH_CAPSULE_REPOSITORY_MISMATCH');
  if (capsule.branch !== BRANCH) throw new Error('PATCH_CAPSULE_BRANCH_MISMATCH');
  assertSha(capsule.sourceSha, 'source');
  assertSha(capsule.parentSha, 'parent');
  assertSha(capsule.candidateSha, 'candidate');
  if (capsule.parentSha !== capsule.sourceSha) throw new Error('PATCH_CAPSULE_PARENT_SOURCE_MISMATCH');
  if (typeof capsule.patchText !== 'string') throw new Error('PATCH_CAPSULE_PATCH_TEXT_REQUIRED');
  if (Buffer.byteLength(capsule.patchText, 'utf8') > MAX_PATCH_BYTES) throw new Error('PATCH_CAPSULE_PATCH_TOO_LARGE');
  if (!HASH_RE.test(capsule.patchSha256 ?? '')) throw new Error('PATCH_CAPSULE_PATCH_HASH_INVALID');
  if (sha256(capsule.patchText) !== capsule.patchSha256) throw new Error('PATCH_CAPSULE_PATCH_HASH_MISMATCH');
  if (!Array.isArray(capsule.paths) || capsule.paths.some((value) => typeof value !== 'string' || !value)) {
    throw new Error('PATCH_CAPSULE_PATHS_INVALID');
  }
  return true;
}

function reconcile({ capsule, targetSha, cwd = process.cwd(), patchFile = null, preserveWorktree = false }) {
  verify(capsule);
  assertSha(targetSha, 'target');

  runGit(['reset', '--hard', targetSha], cwd);
  runGit(['clean', '-ffd'], cwd);

  const patchPath = patchFile ?? `${cwd}/.flixo-patch-capsule-${process.pid}.patch`;
  writeFile(patchPath, capsule.patchText, 'utf8');

  try {
    if (!capsule.patchText) {
      return {
        protocolVersion: PROTOCOL,
        sourceSha: capsule.sourceSha,
        targetSha,
        parentSha: targetSha,
        patchSha256: sha256(''),
        patchText: '',
        paths: [],
        status: 'NOOP',
      };
    }

    try {
      runGit(['apply', '--3way', '--check', patchPath], cwd);
      runGit(['apply', '--3way', '--whitespace=nowarn', patchPath], cwd);
    } catch (error) {
      const message = String(error?.stderr ?? error?.message ?? error).slice(0, 3000);
      throw new Error(`PATCH_CAPSULE_CONFLICT:${message}`);
    }

    const status = runGit(['status', '--short'], cwd);
    const reconciledPatch = runGit(['diff', '--binary', '--full-index', '--'], cwd);
    const paths = runGit(['diff', '--name-only', '--'], cwd);
    const reconciled = {
      protocolVersion: PROTOCOL,
      sourceSha: capsule.sourceSha,
      targetSha,
      parentSha: targetSha,
      patchSha256: sha256(reconciledPatch),
      patchText: reconciledPatch,
      paths: paths ? paths.split('\n').filter(Boolean) : [],
      status: status ? 'RECONCILED' : 'NOOP',
      originalPatchSha256: capsule.patchSha256,
    };
    if (!reconciledPatch && capsule.patchText) {
      throw new Error('PATCH_CAPSULE_RECONCILIATION_DROPPED_PATCH');
    }
    return reconciled;
  } finally {
    if (existsSync(patchPath) && patchFile === null) {
      if (!preserveWorktree) runGit(['checkout', '--', '.'], cwd);
      rmSync(patchPath, { force: true });
    }
  }
}

async function persistCapsule({ capsule, taskId = '', workPackageId = '', sourceRunId = null }) {
  verify(capsule);
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const secret = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !secret) throw new Error('PATCH_CAPSULE_SUPABASE_NOT_CONFIGURED');

  const payload = {
    p_proposal_id: `${taskId || capsule.taskId || 'PATCH-CAPSULE'}:${capsule.candidateSha}`,
    p_repository: capsule.repository,
    p_branch: capsule.branch,
    p_task_id: taskId || capsule.taskId || 'PATCH-CAPSULE',
    p_work_package_id: workPackageId || capsule.workPackageId || 'PATCH-CAPSULE',
    p_target_sha: capsule.sourceSha,
    p_parent_sha: capsule.parentSha,
    p_candidate_sha: capsule.candidateSha,
    p_patch_sha256: capsule.patchSha256,
    p_paths: capsule.paths,
    p_patch_text: capsule.patchText,
    p_push_manifest: { protocolVersion: PROTOCOL, branch: BRANCH, noDirectPushByAgent: true },
    p_validation_report: { authority: 'WORK_PRODUCT_ONLY', validationStatus: 'NOT_CERTIFICATION', sourceSha: capsule.sourceSha },
    p_source_run_id: sourceRunId,
  };

  const response = await fetch(`${url}/rest/v1/rpc/flix_controller_push_queue_enqueue`, {
    method: 'POST',
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const bodyText = await response.text();
  if (!response.ok) throw new Error(`PATCH_CAPSULE_PERSIST_FAILED:http_${response.status}:${bodyText.slice(0,1000)}`);
  return bodyText ? JSON.parse(bodyText) : null;
}

function usage() {
  console.error([
    'Usage:',
    '  patch-capsule.mjs capture --source <sha> --candidate <sha> [--out <file>]',
    '  patch-capsule.mjs verify --file <file>',
    '  patch-capsule.mjs reconcile --file <file> --target <sha> [--worktree <dir>] [--out <file>]',
    '  patch-capsule.mjs persist --file <file> --task <id> [--work-package <id>] [--run-id <id>]',
  ].join('\n'));
  process.exit(2);
}

const [command, ...args] = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
if (!command) usage();

if (command === 'capture') {
  const sourceSha = value('--source');
  const candidateSha = value('--candidate');
  if (!sourceSha || !candidateSha) usage();
  const capsule = capture({ sourceSha, candidateSha });
  const output = value('--out');
  if (output) await writeFile(output, JSON.stringify(capsule, null, 2) + '\n', 'utf8');
  else process.stdout.write(JSON.stringify(capsule, null, 2) + '\n');
} else if (command === 'verify') {
  const file = value('--file');
  if (!file) usage();
  const capsule = JSON.parse(await readFile(file, 'utf8'));
  verify(capsule);
  console.log('PATCH_CAPSULE_VERIFY=PASS');
} else if (command === 'reconcile') {
  const file = value('--file');
  const targetSha = value('--target');
  if (!file || !targetSha) usage();
  const capsule = JSON.parse(await readFile(file, 'utf8'));
  const result = reconcile({ capsule, targetSha, cwd: value('--worktree') || process.cwd() });
  const output = value('--out');
  if (output) await writeFile(output, JSON.stringify(result, null, 2) + '\n', 'utf8');
  else process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else if (command === 'persist') {
  const file = value('--file');
  const taskId = value('--task');
  if (!file || !taskId) usage();
  const capsule = JSON.parse(await readFile(file, 'utf8'));
  const result = await persistCapsule({
    capsule,
    taskId,
    workPackageId: value('--work-package') || '',
    sourceRunId: value('--run-id') ? Number(value('--run-id')) : null,
  });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else {
  usage();
}
}

export { capture, verify, reconcile, persistCapsule };
