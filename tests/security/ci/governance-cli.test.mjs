import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';
import { evaluateMainGovernance } from '../../../scripts/ci/verify-main-ruleset.mjs';

const root = process.cwd();
const cli = join(root, 'scripts/ci/check-governance.sh');
const bash = process.platform === 'win32'
  ? process.env.FLIXO_BASH_EXECUTABLE ?? [
      join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
      join(process.env.LOCALAPPDATA ?? '', 'hermes', 'tools', 'git-2.53.0+3-win32-x64', 'usr', 'bin', 'bash.exe'),
    ].find(existsSync) ?? 'bash'
  : 'bash';
const cliArgument = process.platform === 'win32'
  ? `/${cli[0].toLowerCase()}${cli.slice(2).replaceAll(String.fromCharCode(92), '/')}`
  : cli;

function ruleset(overrides = {}) {
  return [{
    id: 9001,
    name: 'FLIXO-MAIN-PROTECTION',
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: ['refs/heads/main'] } },
    rules: [
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: 1,
          dismiss_stale_reviews_on_push: true,
          require_code_owner_review: true,
          require_last_push_approval: true,
          required_review_thread_resolution: true,
          ...(overrides.pullRequest ?? {}),
        },
      },
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: [
            { context: 'trust-gate' },
            { context: 'Exact-SHA promotion proof' },
          ],
          ...(overrides.statusChecks ?? {}),
        },
      },
    ],
  }];
}

test('governance evaluator accepts the complete live-policy contract', () => {
  const result = evaluateMainGovernance(ruleset(), 'main', 'strict');
  assert.equal(result.pass, true);
  assert.deepEqual(result.failures, []);
});

test('governance evaluator fails closed when independent approval is removed', () => {
  const result = evaluateMainGovernance(
    ruleset({ pullRequest: { require_last_push_approval: false } }),
    'main',
    'strict',
  );
  assert.equal(result.pass, false);
  assert.match(result.failures.join('\n'), /Latest-push approval/);
});

test('governance CLI accepts an explicit mock without pretending it is live evidence', () => {
  const dir = mkdtempSync(join(root, '.governance-test-'));
  const mock = join(dir, 'rulesets.json');
  writeFileSync(mock, JSON.stringify(ruleset()), 'utf8');

  try {
    const output = execFileSync(bash, [cliArgument], {
      cwd: root,
      env: { ...process.env, GOVERNANCE_MOCK_FILE: mock, GOVERNANCE_MODE: 'strict', GOVERNANCE_BRANCH: 'main' },
      encoding: 'utf8',
    });
    assert.match(output, /MAIN_GOVERNANCE=PASS/u);
    assert.match(output, /GOVERNANCE_SOURCE=MOCK/u);
    assert.match(output, /GOVERNANCE_MODE=strict/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('governance CLI refuses live mode when evidence credentials are absent', () => {
  assert.throws(
    () => execFileSync(bash, [cliArgument], {
      cwd: root,
      env: { PATH: process.env.PATH, GOVERNANCE_MODE: 'strict', GOVERNANCE_BRANCH: 'main' },
      encoding: 'utf8',
      stdio: 'pipe',
    }),
    /GOVERNANCE_EVIDENCE_UNAVAILABLE/u,
  );
});
