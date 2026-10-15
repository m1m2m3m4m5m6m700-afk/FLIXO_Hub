import test from 'node:test';
import assert from 'node:assert/strict';

test('AGENT_RUNNER_CONTROL_PLANE=EXECUTABLE', async () => {
  const mod = await import('../scripts/agent-control-plane.mjs');
  const currentSha = (await import('node:child_process')).execFileSync(
    'git',
    ['rev-parse', 'HEAD'],
    { encoding: 'utf8' },
  ).trim();
  const result = mod.auditAgentControlPlane(process.cwd(), currentSha);
  assert.equal(result.sha, currentSha);
  assert.equal(result.registry.principalCount, 10);
  assert.equal(result.registry.supportCount, 1);
  assert.equal(result.agents.length, 11);
  assert.equal(result.envelope.envelopes.length, result.envelope.activeTaskCount);
  assert.ok(['PASS', 'BLOCKED'].includes(result.status));
  assert.ok(Array.isArray(result.issues));
});

test('AGENT_RUNNER_CONTROL_MATRIX=is-bounded', async () => {
  const mod = await import('../scripts/agent-control-plane.mjs');
  const matrix = mod.hardControlTestMatrix();
  assert.equal(matrix.length, 29);
  assert.equal(new Set(matrix).size, matrix.length);
});
