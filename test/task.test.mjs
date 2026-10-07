import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  dispatchNext,
  discoverTasks,
  extractPullRequestNumber,
  isTrustedRef,
  parseRepairCommand,
  processTask,
  runCommand,
  SubprocessError,
} from '../scripts/agent/task.mjs';

test('runCommand times out and kills the full subprocess tree', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'flixo-process-'));
  const pidFile = join(dir, 'child.pid');
  try {
    const script = `import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs'; const child=spawn(process.execPath,['-e','setTimeout(()=>{},10000)'],{stdio:'ignore'}); writeFileSync(${JSON.stringify(pidFile)},String(child.pid)); setTimeout(()=>{},10000);`;
    await assert.rejects(
      runCommand(process.execPath, ['--input-type=module', '-e', script], { timeoutMs: 300, maxOutputChars: 10_000 }),
      (error) => error instanceof SubprocessError && error.code === 'SUBPROCESS_TIMEOUT',
    );
    const { readFile } = await import('node:fs/promises');
    const childPid = Number(await readFile(pidFile, 'utf8'));
    assert.ok(Number.isInteger(childPid) && childPid > 1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.throws(() => process.kill(childPid, 0));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('runCommand fails closed on combined output limit', async () => {
  await assert.rejects(
    runCommand(process.execPath, ['-e', "process.stdout.write('x'.repeat(2000)); process.stderr.write('y'.repeat(2000));"], { timeoutMs: 1000, maxOutputChars: 3000 }),
    (error) => error instanceof SubprocessError && error.code === 'SUBPROCESS_OUTPUT_LIMIT',
  );
});

test('dispatchNext stops after four failed tries', async () => {
  let calls = 0;
  await assert.rejects(dispatchNext({
    repository: 'acme/flixo', workflow: 'repair-agent.yml', ref: 'refs/heads/execution',
    runGhImpl: async () => { calls += 1; throw new Error('temporary'); },
  }), /DISPATCH_FAILED_AFTER_RETRIES/u);
  assert.equal(calls, 4);
});

test('discoverTasks pins the repository, rejects PR entries, and bounds issue bodies', async () => {
  const hugeBody = 'x'.repeat(50_000);
  const result = await discoverTasks({
    repository: 'm1m2m3m4m5m6m700-afk/FLIXO_Hub',
    runGhImpl: async (args) => {
      assert.deepEqual(args.slice(0, 5), ['issue', 'list', '--repo', 'm1m2m3m4m5m6m700-afk/FLIXO_Hub', '--state']);
      return { stdout: JSON.stringify([
        { number: 7, title: 'Fix', body: hugeBody, url: 'https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/issues/7', state: 'OPEN', isPullRequest: false, labels: [] },
        { number: 8, title: 'PR', body: 'nope', state: 'OPEN', isPullRequest: true, labels: [] },
        { number: 7, title: 'duplicate', body: 'ignored', state: 'OPEN', isPullRequest: false, labels: [] },
      ]) };
    },
  });
  assert.equal(result.length, 1);
  assert.match(result[0].id, /^issue:[0-9a-f]{32}$/u);
  assert.equal(result[0].body.length, 20_000);
});

test('dispatchNext retries at most four times and accepts only trusted refs', async () => {
  let calls = 0;
  const result = await dispatchNext({
    repository: 'acme/flixo',
    workflow: 'repair-agent.yml',
    ref: 'refs/heads/execution',
    inputs: { task_id: 'abc' },
    runGhImpl: async (args) => {
      calls += 1;
      if (calls < 3) throw new Error('temporary');
      assert.equal(args[0], 'workflow');
      assert.equal(args[args.indexOf('--repo') + 1], 'acme/flixo');
      assert.equal(args[args.indexOf('--ref') + 1], 'refs/heads/execution');
    },
  });
  assert.equal(result.tries, 3);
  assert.equal(calls, 3);
  assert.equal(isTrustedRef('origin'), false);
  assert.equal(isTrustedRef('refs/heads/main'), false);
  assert.equal(isTrustedRef('refs/heads/execution'), true);
});

test('processTask keeps PR draft unless verification PASS', async () => {
  const calls = [];
  const runGhImpl = async (args) => { calls.push(args); return { stdout: '' }; };
  const baseTask = {
    id: 'issue:invalid',
    repository: 'acme/flixo',
    number: 9,
    title: 'safe task',
    body: 'safe',
    url: 'https://github.com/acme/flixo/issues/9',
  };
  const crypto = await import('node:crypto');
  baseTask.id = `issue:${crypto.createHash('sha256').update('acme/flixo#9').digest('hex').slice(0,32)}`;

  await assert.rejects(
    processTask(baseTask, {
      repairCommand: ['node', 'repair.js'],
      runCommandImpl: async () => ({ stdout: 'https://github.com/acme/flixo/pull/41', stderr: '' }),
      verifyImpl: async () => ({ verdict: 'fail', reason: 'bad', findings: [{ priority: 'high', issue: 'x', location: 'x', evidence: 'x' }], model: 'test' }),
      runGhImpl,
    }),
  );
  assert.equal(calls.some((a) => a.includes('-F') && a.includes('draft=true')), true);
  assert.equal(calls.some((a) => a.includes('-F') && a.includes('draft=false')), false);
});

test('processTask passes only a restricted environment to non-gh repair commands', async () => {
  const crypto = await import('node:crypto');
  const task = {
    repository: 'acme/flixo', number: 10, title: 'safe', body: 'safe', url: 'https://github.com/acme/flixo/issues/10',
    id: `issue:${crypto.createHash('sha256').update('acme/flixo#10').digest('hex').slice(0,32)}`,
  };
  process.env.OPENAI_API_KEY = 'secret-test';
  process.env.AGENT_TOKEN = 'secret-agent';
  let childOptions;
  await assert.rejects(processTask(task, {
    repairCommand: ['node', 'repair.js'],
    runCommandImpl: async (_command, _args, options) => { childOptions = options; return { stdout: 'PR #51', stderr: '' }; },
    verifyImpl: async () => ({ verdict: 'fail', reason: 'stop', findings: [], model: 'test' }),
    runGhImpl: async () => ({ stdout: '' }),
  }));
  assert.equal(childOptions.env.OPENAI_API_KEY, undefined);
  assert.equal(childOptions.env.AGENT_TOKEN, undefined);
  assert.ok(childOptions.env.PATH);
});

test('processTask makes a PR ready only after PASS and stable SHA recheck', async () => {
  const crypto = await import('node:crypto');
  const task = { repository: 'acme/flixo', number: 11, title: 'safe', body: 'safe', url: 'https://github.com/acme/flixo/issues/11', id: `issue:${crypto.createHash('sha256').update('acme/flixo#11').digest('hex').slice(0,32)}` };
  const calls = [];
  const result = await processTask(task, {
    repairCommand: ['node', 'repair.js'],
    runCommandImpl: async () => ({ stdout: 'https://github.com/acme/flixo/pull/52', stderr: '' }),
    verifyImpl: async () => ({ verdict: 'pass', reason: 'clean', findings: [], model: 'test', baseSha: 'base', headSha: 'head' }),
    recheckImpl: async (input) => { assert.equal(input.expectedHeadSha, 'head'); assert.equal(input.expectedBaseSha, 'base'); return true; },
    runGhImpl: async (args) => { calls.push(args); return { stdout: '' }; },
  });
  assert.equal(result.status, 'done');
  assert.ok(calls.some((a) => a.includes('draft=true')));
  assert.ok(calls.some((a) => a.includes('draft=false')));
  assert.equal(calls.findIndex((a) => a.includes('draft=true')) < calls.findIndex((a) => a.includes('draft=false')), true);
});

test('extractPullRequestNumber is deterministic and bounded', () => {
  assert.equal(extractPullRequestNumber('created https://github.com/acme/flixo/pull/123'), 123);
  assert.equal(extractPullRequestNumber('PR #45'), 45);
  assert.equal(extractPullRequestNumber('nothing'), null);
});

test('parseRepairCommand refuses shell strings and malformed JSON', () => {
  assert.throws(() => parseRepairCommand('node repair.js && rm -rf /'), /JSON_INVALID/u);
  assert.throws(() => parseRepairCommand(JSON.stringify('node repair.js')), /UNSAFE/u);
});
