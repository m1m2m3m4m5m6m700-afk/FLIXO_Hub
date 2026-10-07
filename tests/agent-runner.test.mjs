import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('AGENT_RUNNER_CONTROL_PLANE=PASS', () => {
  const output = execFileSync(
    process.execPath,
    ['scripts/agent-control-plane.mjs'],
    { encoding: 'utf8' },
  );
  const result = JSON.parse(output);
  assert.equal(result.status, 'PASS');
  assert.equal(result.envelope.sha, execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
});

test('AGENT_RUNNER_CONTROL_MATRIX=is-bounded', async () => {
  const mod = await import('../scripts/agent-control-plane.mjs');
  const matrix = mod.hardControlTestMatrix();
  assert.equal(matrix.length, 30);
  assert.equal(new Set(matrix).size, matrix.length);
});
