import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

import {
  AGENT_ID,
  BudgetExceededError,
  DEFAULT_OUTPUT_LIMIT,
  deterministicIdentity,
  envInt,
  log,
  sanitizeText,
  canonicalRepository,
  sleep,
  withTimeout,
} from './lib.mjs';
import { assertPullRequestStable, verifyPullRequest } from './verify.mjs';

export const GH_TIMEOUT_MS = envInt('GH_TIMEOUT_MS', 30_000, 1_000, 10 * 60_000);
export const TASK_OUTPUT_LIMIT = envInt('TASK_OUTPUT_LIMIT_CHARS', DEFAULT_OUTPUT_LIMIT, 4_096, 2_000_000);
export const TASK_BODY_LIMIT = envInt('TASK_BODY_MAX_CHARS', 20_000, 512, 100_000);
export const DISPATCH_MAX_TRIES = 4;

export class SubprocessError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SubprocessError';
    Object.assign(this, details);
  }
}

export class VerificationError extends Error {
  constructor(message, verification) {
    super(message);
    this.name = 'VerificationError';
    this.code = 'VERIFIER_FAILED';
    this.verification = verification;
  }
}

export async function runCommand(command, args = [], {
  cwd = process.cwd(),
  env = process.env,
  timeoutMs = DEFAULT_TIMEOUT,
  input = null,
  maxOutputChars = TASK_OUTPUT_LIMIT,
  signal,
} = {}) {
  assertArgv(command, args);
  const child = spawn(command, args, {
    cwd,
    env: { ...env },
    shell: false,
    detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  let outputTooLarge = false;
  let terminations = 0;
  let terminationPromise = null;
  let outputChars = 0;
  let closeInfo;
  let childError;

  const append = (target, chunk) => {
    const piece = chunk.toString('utf8');
    const current = target === 'stdout' ? stdout : stderr;
    outputChars += piece.length;
    const next = current + piece;
    if (outputChars > maxOutputChars) {
      outputTooLarge = true;
      return false;
    }
    if (target === 'stdout') stdout = next;
    else stderr = next;
    return true;
  };

  const terminateOnce = () => {
    if (!terminationPromise) terminationPromise = terminateProcessTree(child).finally(() => { terminations += 1; });
    return terminationPromise;
  };
  child.stdout.on('data', (chunk) => {
    if (!append('stdout', chunk)) void terminateOnce();
  });
  child.stderr.on('data', (chunk) => {
    if (!append('stderr', chunk)) void terminateOnce();
  });
  child.on('error', (error) => { childError = error; });
  const onAbort = () => void terminateOnce();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    if (input != null) child.stdin.end(typeof input === 'string' ? input : JSON.stringify(input));
    else child.stdin.end();
    closeInfo = await withTimeout(() => once(child, 'close'), timeoutMs, `subprocess timeout: ${command}`, signal);
  } catch (error) {
    await terminateProcessTree(child);
    if (error?.code === 'TIMEOUT' || /timeout/iu.test(error?.message || '')) {
      throw new SubprocessError(`SUBPROCESS_TIMEOUT: ${command}`, { code: 'SUBPROCESS_TIMEOUT', stdout, stderr, command, args });
    }
    throw error;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }

  const [exitCode, exitSignal] = closeInfo;
  if (childError) throw new SubprocessError(childError.message, { cause: childError, stdout, stderr, command, args });
  if (outputTooLarge) {
    throw new SubprocessError(`SUBPROCESS_OUTPUT_LIMIT: ${command}`, { code: 'SUBPROCESS_OUTPUT_LIMIT', stdout, stderr, command, args });
  }
  if (exitCode !== 0) {
    throw new SubprocessError(`SUBPROCESS_EXIT_${exitCode ?? 'UNKNOWN'}: ${command}`, {
      code: 'SUBPROCESS_EXIT', exitCode, exitSignal, stdout, stderr, command, args,
    });
  }
  return { stdout, stderr, exitCode, exitSignal, terminations };
}

const DEFAULT_TIMEOUT = envInt('REPAIR_COMMAND_TIMEOUT_MS', 5 * 60_000, 1_000, 30 * 60_000);

export async function terminateProcessTree(child, { graceMs = 750 } = {}) {
  if (!child || typeof child.pid !== 'number') return;
  if (child.killed && child.exitCode !== null) return;
  const pid = child.pid;
  const send = (signalName) => {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { shell: false, stdio: 'ignore', windowsHide: true });
        return true;
      }
      return process.kill(-pid, signalName);
    } catch {
      try { return child.kill(signalName); } catch { return false; }
    }
  };
  send('SIGTERM');
  await sleep(graceMs).catch(() => {});
  if (child.exitCode === null) send(process.platform === 'win32' ? 'SIGKILL' : 'SIGKILL');
}

export async function runGh(args, options = {}) {
  return runCommand('gh', args, { timeoutMs: GH_TIMEOUT_MS, ...options });
}

export async function discoverTasks({ repository = process.env.GITHUB_REPOSITORY, runGhImpl = runGh } = {}) {
  const repo = canonicalRepository(repository);
  if (!repo) throw new Error('DISCOVER_REQUIRES_CANONICAL_REPOSITORY');
  const result = await runGhImpl([
    'search', 'issues', '--repo', repo, '--state', 'open', '--limit', '100',
    '--json', 'number,title,body,url,labels,state,isPullRequest',
  ]);
  let issues;
  try { issues = JSON.parse(result.stdout); } catch { throw new Error('DISCOVER_INVALID_JSON'); }
  if (!Array.isArray(issues)) throw new Error('DISCOVER_INVALID_RESPONSE');
  const seen = new Set();
  return issues.flatMap((issue) => {
    const number = Number(issue?.number);
    if (issue?.isPullRequest === true || !Number.isInteger(number) || number <= 0 || seen.has(number)) return [];
    seen.add(number);
    const body = sanitizeText(issue?.body || '', TASK_BODY_LIMIT);
    return [{
      id: deterministicIdentity(repo, number),
      repository: repo,
      number,
      url: sanitizeText(issue?.url || '', 512),
      title: sanitizeText(issue?.title || `Issue #${number}`, 512),
      body,
      labels: Array.isArray(issue?.labels) ? issue.labels.map((l) => sanitizeText(l?.name || l, 100)).filter(Boolean).slice(0, 30) : [],
    }];
  });
}

export function parseRepairCommand(value = process.env.REPAIR_COMMAND_JSON) {
  if (!value) throw new Error('REPAIR_COMMAND_JSON_REQUIRED');
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw new Error('REPAIR_COMMAND_JSON_INVALID'); }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 32 || parsed.some((part) => typeof part !== 'string' || part.length > 2_000)) {
    throw new Error('REPAIR_COMMAND_JSON_UNSAFE');
  }
  return parsed;
}

export function extractPullRequestNumber(output) {
  const text = String(output || '').slice(0, 250_000);
  const url = text.match(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/(\d+)\b/u);
  if (url) return Number(url[1]);
  const patterns = [
    /\bPR\s*#?\s*(\d+)\b/iu,
    /\bpull request\s*#?\s*(\d+)\b/iu,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

function buildRepairEnv(executable) {
  const source = process.env;
  const env = {};
  const safeNames = /^(?:PATH|HOME|USER|LOGNAME|TMPDIR|TMP|TEMP|SYSTEMROOT|COMSPEC|SHELL|LANG|LC_[A-Z0-9_]+|CI|GITHUB_(?:REPOSITORY|REF|SHA|WORKFLOW|RUN_ID|RUN_NUMBER))$/u;
  for (const [key, value] of Object.entries(source)) {
    if (safeNames.test(key) && !/(?:TOKEN|SECRET|KEY|PASSWORD|AUTH)/iu.test(key)) env[key] = value;
  }
  const allowed = String(source.REPAIR_ALLOWED_ENV || '').split(',').map((name) => name.trim()).filter((name) => /^[A-Z_][A-Z0-9_]*$/u.test(name));
  for (const name of allowed) if (name in source && !/(?:TOKEN|SECRET|KEY|PASSWORD|AUTH)/iu.test(name)) env[name] = source[name];
  if (basename(executable).toLowerCase() === 'gh') {
    if (source.GH_TOKEN) env.GH_TOKEN = source.GH_TOKEN;
    else if (source.GITHUB_TOKEN) env.GITHUB_TOKEN = source.GITHUB_TOKEN;
  }
  return env;
}

function assertArgv(command, args) {
  if (typeof command !== 'string' || command.length < 1 || command.length > 256 || /[\u0000\r\n]/u.test(command)) throw new TypeError('Invalid command');
  if (!Array.isArray(args) || args.length > 64 || args.some((arg) => typeof arg !== 'string' || /[\u0000]/u.test(arg))) throw new TypeError('Invalid arguments');
}

export async function processTask(task, {
  repairCommand = parseRepairCommand(),
  runCommandImpl = runCommand,
  verifyImpl = verifyPullRequest,
  recheckImpl = assertPullRequestStable,
  runGhImpl = runGh,
  signal,
  taskHardMs = envInt('TASK_HARD_MS', 15 * 60_000, 5_000, 60 * 60_000),
  budget = null,
} = {}) {
  validateTask(task);
  const repairStartedAt = Date.now();
  const command = [...repairCommand];
  const [executable, ...args] = command;
  const repairPayload = JSON.stringify({
    agent_id: AGENT_ID,
    task: {
      id: task.id,
      repository: task.repository,
      number: task.number,
      title: task.title,
      body: task.body,
      url: task.url,
    },
  });
  const result = await withTimeout(
    (innerSignal) => runCommandImpl(executable, args, {
      input: repairPayload,
      timeoutMs: taskHardMs,
      signal: innerSignal,
      env: buildRepairEnv(executable),
    }),
    taskHardMs + 1_000,
    'task hard timeout',
    signal,
  );
  const prNumber = extractPullRequestNumber(`${result.stdout}\n${result.stderr}`);
  if (!prNumber) throw new Error('REPAIR_COMMAND_DID_NOT_RETURN_PR');
  if (!Number.isInteger(prNumber) || prNumber <= 0) throw new Error('REPAIR_COMMAND_RETURNED_INVALID_PR');
  const repo = canonicalRepository(task.repository);
  const prIdentity = await getRepairPullRequestIdentity(repo, prNumber, runGhImpl);
  if (!isFreshRepairPullRequest(prIdentity, repo, prNumber, repairStartedAt)) throw new Error('REPAIR_PR_PROVENANCE_FAILED');
  await setPullRequestDraft(repo, prNumber, runGhImpl);
  const verification = await verifyImpl({ repository: repo, prNumber });
  await commentVerification(repo, prNumber, verification, runGhImpl);
  if (verification.verdict !== 'pass') {
    await addFailureLabel(repo, prNumber, runGhImpl);
    throw new VerificationError('PR_VERIFICATION_FAILED', verification);
  }
  const stable = await recheckImpl({ repository: repo, prNumber, expectedHeadSha: verification.headSha, expectedBaseSha: verification.baseSha });
  if (!stable) throw new VerificationError('PR_VERIFICATION_RACE', { ...verification, reason: 'pull request changed after verification' });
  await setPullRequestReady(repo, prNumber, runGhImpl);
  return { status: 'done', prNumber, verification };
}

export async function getRepairPullRequestIdentity(repository, prNumber, runGhImpl = runGh) {
  const result = await runGhImpl([
    'pr', 'view', String(prNumber), '--repo', repository,
    '--json', 'number,state,baseRefName,headRepository,createdAt,isDraft',
  ]);
  let parsed;
  try { parsed = JSON.parse(result.stdout); } catch { throw new Error('REPAIR_PR_IDENTITY_INVALID_JSON'); }
  return parsed;
}

export function isFreshRepairPullRequest(pr, repository, prNumber, repairStartedAt, skewMs = 120_000) {
  if (!pr || Number(pr.number) !== Number(prNumber)) return false;
  if (pr.state !== 'OPEN') return false;
  if (pr.headRepository?.name && pr.headRepository?.owner?.login) {
    const owner = sanitizeText(pr.headRepository.owner.login, 100);
    const name = sanitizeText(pr.headRepository.name, 100);
    if (canonicalRepository(`${owner}/${name}`) !== repository) return false;
  } else if (pr.headRepository?.fullName && canonicalRepository(pr.headRepository.fullName) !== repository) {
    return false;
  } else {
    return false;
  }
  const createdAt = Date.parse(pr.createdAt || '');
  if (!Number.isFinite(createdAt)) return false;
  return createdAt >= Number(repairStartedAt) - skewMs && createdAt <= Date.now() + skewMs;
}

export async function commentVerification(repository, prNumber, verification, runGhImpl = runGh) {
  const summary = [
    `repair-agent verifier: ${verification.verdict.toUpperCase()}`,
    `reason: ${sanitizeText(verification.reason || 'n/a', 500)}`,
    `high/medium findings: ${verification.findings.filter((f) => ['high', 'medium'].includes(f.priority)).length}`,
    `model: ${sanitizeText(verification.model || 'unknown', 128)}`,
  ].join('\n');
  await runGhImpl([
    'api', '--method', 'POST', `repos/${repository}/issues/${prNumber}/comments`,
    '-f', `body=${summary}`,
  ]);
}

export async function addFailureLabel(repository, prNumber, runGhImpl = runGh) {
  await runGhImpl([
    'api', '--method', 'POST', `repos/${repository}/issues/${prNumber}/labels`,
    '-f', 'labels[]=repair-agent:verification-failed',
  ]);
}

export async function setPullRequestDraft(repository, prNumber, runGhImpl = runGh) {
  return runGhImpl([
    'api', '--method', 'PATCH', `repos/${repository}/pulls/${prNumber}`,
    '-F', 'draft=true',
  ]);
}

export async function setPullRequestReady(repository, prNumber, runGhImpl = runGh) {
  return runGhImpl([
    'api', '--method', 'PATCH', `repos/${repository}/pulls/${prNumber}`,
    '-F', 'draft=false',
  ]);
}

export async function dispatchNext({ repository, workflow, ref, inputs = {}, runGhImpl = runGh, maxTries = DISPATCH_MAX_TRIES }) {
  const repo = canonicalRepository(repository);
  const safeWorkflow = sanitizeText(workflow, 256).replace(/^.*\//u, '');
  const safeRef = sanitizeText(ref, 256);
  if (!repo || !safeWorkflow || !safeRef || safeRef === 'origin' || !isTrustedRef(safeRef)) {
    throw new Error('DISPATCH_REQUIRES_CANONICAL_REPOSITORY_WORKFLOW_REF');
  }
  const safeInputs = Object.fromEntries(Object.entries(inputs).slice(0, 16).map(([key, value]) => [
    sanitizeText(key, 64), sanitizeText(value, 512),
  ]));
  let attempt = 0;
  let lastError;
  while (attempt < Math.min(DISPATCH_MAX_TRIES, Math.max(1, maxTries))) {
    attempt += 1;
    try {
      const args = ['workflow', 'run', safeWorkflow, '--repo', repo, '--ref', safeRef];
      for (const [key, value] of Object.entries(safeInputs)) args.push('-f', `${key}=${value}`);
      await runGhImpl(args);
      return { dispatched: true, tries: attempt, repository: repo, workflow: safeWorkflow, ref: safeRef };
    } catch (error) {
      lastError = error;
      if (attempt >= Math.min(DISPATCH_MAX_TRIES, Math.max(1, maxTries))) break;
      await sleep(250 * (2 ** (attempt - 1)));
    }
  }
  throw new SubprocessError('DISPATCH_FAILED_AFTER_RETRIES', { cause: lastError, tries: attempt });
}

export function isTrustedRef(ref) {
  const value = String(ref || '');
  return /^refs\/heads\/(?:execution|agent(?:[-/][A-Za-z0-9._/-]+)?|agent\d+\/[A-Za-z0-9._/-]+)$/u.test(value);
}

export function validateTask(task) {
  if (!task || typeof task !== 'object') throw new TypeError('Invalid task');
  const repo = canonicalRepository(task.repository);
  const number = Number(task.number);
  const id = deterministicIdentity(repo, number);
  if (id !== task.id) throw new Error('TASK_IDENTITY_MISMATCH');
  if (String(task.body || '').length > TASK_BODY_LIMIT) throw new Error('TASK_BODY_TOO_LARGE');
  return true;
}

export function taskLeaseKey(task) {
  return createHash('sha256').update(`${task.repository}#${task.number}:${task.id}`).digest('hex').slice(0, 32);
}
