import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();
const runnerPath = path.join(repoRoot, 'scripts', 'run-python.mjs');
const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'flixo-python-runner-'));
const fixturePath = path.join(tempRoot, 'runner_fixture.py');

function runRunner(scriptPath, ...args) {
  return spawnSync(process.execPath, [runnerPath, scriptPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true,
  });
}

test.after(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

test('passes script arguments without splitting spaces', () => {
  writeFileSync(
    fixturePath,
    'import json, sys\nprint(json.dumps(sys.argv[1:]))\n',
    'utf8',
  );

  const result = runRunner(fixturePath, 'alpha', 'two words');

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), ['alpha', 'two words']);
});

test('propagates the Python script exit code', () => {
  writeFileSync(
    fixturePath,
    'import sys\nsys.exit(7)\n',
    'utf8',
  );

  const result = runRunner(fixturePath);

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 7, result.stderr);
});

test('fails clearly when the requested script is missing', () => {
  const missingPath = path.join(tempRoot, 'does-not-exist.py');
  const result = runRunner(missingPath);

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 66);
  assert.match(result.stderr, /Python script not found/);
});
