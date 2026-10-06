import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  evaluateMainGovernance,
  verifyLiveMainGovernance,
} from '../../scripts/ci/verify-main-ruleset.mjs';
import {
  QUARANTINED_REFS,
  analyzeWorkflowAuthority,
  analyzeWorkflowSet,
  classifyRef,
  parseRemoteRefs,
} from '../../scripts/ci/verify-branch-policy.mjs';

const repoRoot = new URL('../../', import.meta.url);
const readRepo = (path) => readFileSync(new URL(path, repoRoot), 'utf8');

test('CODEOWNERS has explicit fail-closed coverage for security-critical ownership boundaries', () => {
  const content = readRepo('.github/CODEOWNERS');
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  const entries = lines.map((line) => line.split(/\s+/u));
  assert.ok(
    entries.every(
      (parts) =>
        parts.length >= 2 &&
        parts.slice(1).every((owner) => owner.startsWith('@')),
    ),
  );

  const patterns = new Set(entries.map((parts) => parts[0]));
  for (const required of [
    '/api/admin/**',
    '/src/server/admin/**',
    '/supabase/**',
    '/src/config/registry.ts',
    '/src/worker.ts',
    '/wrangler.jsonc',
    '/vercel.json',
    '/.github/workflows/**',
  ]) {
    assert.ok(patterns.has(required), `missing explicit CODEOWNERS rule: ${required}`);
  }

  assert.ok(patterns.has('*'), 'repository-wide owner must remain fail-closed');
});

test('CODEOWNERS file coverage and live Code Owner enforcement are distinct evidence layers', () => {
  const content = readRepo('.github/CODEOWNERS');
  assert.match(content, /LIVE ENFORCEMENT IS VERIFIED SEPARATELY FROM THIS FILE/u);
  assert.doesNotMatch(content, /ruleset|protected branch/iu);
});

test('branch refs classify production, integration, controlled-agent, quarantine, and unknown states', () => {
  assert.deepEqual(classifyRef('refs/heads/main'), {
    authority: 'production',
    allowed: true,
    quarantined: false,
  });
  assert.deepEqual(classifyRef('refs/heads/execution'), {
    authority: 'integration',
    allowed: true,
    quarantined: false,
  });
  assert.deepEqual(classifyRef('refs/heads/agent-3/closure-test'), {
    authority: 'controlled-agent',
    allowed: true,
    quarantined: false,
  });
  assert.deepEqual(classifyRef('refs/heads/agent3/verification-test'), {
    authority: 'controlled-agent',
    allowed: true,
    quarantined: false,
  });
  assert.equal(
    classifyRef('refs/heads/agent-2-media-engines-20261006').authority,
    'quarantined-stale',
  );
  assert.equal(classifyRef('refs/heads/feature/unknown').allowed, false);
  assert.equal(classifyRef('refs/heads/agent-9/anything').allowed, false);
  assert.equal(classifyRef('refs/heads/agent-2-unknown-stale').allowed, false);
});

test('remote-ref parsing ignores non-head refs and preserves exact branch refs', () => {
  const refs = parseRemoteRefs(
    [
      'abc refs/heads/main',
      'def refs/heads/execution',
      'ghi refs/tags/release-1.0.0',
      'jkl refs/heads/agent-3/closure-test',
    ].join('\n'),
  );
  assert.deepEqual(refs, [
    'refs/heads/main',
    'refs/heads/execution',
    'refs/heads/agent-3/closure-test',
  ]);
});

test('main governance evaluator requires independent review and strict promotion checks', () => {
  const good = [
    {
      id: 7,
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
          },
        },
      ],
    },
  ];

  assert.equal(evaluateMainGovernance(good).pass, true);
  const bad = structuredClone(good);
  bad[0].rules[0].parameters.required_approving_review_count = 0;
  bad[0].rules[0].parameters.require_last_push_approval = false;
  bad[0].rules[1].parameters.strict_required_status_checks_policy = false;
  assert.equal(evaluateMainGovernance(bad).pass, false);
});

test('main governance evaluator fails closed when no active main-targeted ruleset exists', () => {
  const result = evaluateMainGovernance([]);
  assert.equal(result.pass, false);
  assert.match(result.failures[0], /No active ruleset targets refs\/heads\/main/u);
});

test('live main verifier discovers rulesets instead of relying on a hard-coded ruleset id', async () => {
  const calls = [];
  const responses = new Map([
    [
      'https://api.github.com/repos/acme/flixo/rulesets?per_page=100',
      [
        {
          id: 999,
          target: 'branch',
          enforcement: 'active',
          conditions: {},
          _links: {
            self: {
              href: 'https://api.github.com/repos/acme/flixo/rulesets/999',
            },
          },
        },
      ],
    ],
    [
      'https://api.github.com/repos/acme/flixo/rulesets/999',
      {
        id: 999,
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
            },
          },
        ],
      },
    ],
  ]);

  const result = await verifyLiveMainGovernance({
    token: 'token',
    repo: 'acme/flixo',
    fetchJson: async (url) => {
      calls.push(url);
      return responses.get(url);
    },
  });

  assert.deepEqual(calls, [
    'https://api.github.com/repos/acme/flixo/rulesets?per_page=100',
    'https://api.github.com/repos/acme/flixo/rulesets/999',
  ]);
  assert.deepEqual(result.applicableRulesetIds, [999]);
});

test('workflow authority scans every workflow and enforces production deployment gates', () => {
  const workflows = readdirSync(new URL('../../.github/workflows/', import.meta.url))
    .filter((name) => /\.ya?ml$/iu.test(name))
    .sort()
    .map((name) => ({
      path: join('.github/workflows', name),
      content: readRepo(join('.github/workflows', name)),
    }));

  const report = analyzeWorkflowSet(workflows);
  assert.equal(report.pass, true, report.findings.join('\n'));

  const ci = workflows.find((workflow) => workflow.path.endsWith('/ci.yml'));
  assert.ok(ci);
  assert.equal(analyzeWorkflowAuthority(ci.path, ci.content).pass, true);

  const patchController = workflows.find((workflow) =>
    workflow.path.endsWith('/patch-capsule-controller.yml'),
  );
  assert.ok(patchController);
  assert.equal(
    analyzeWorkflowAuthority(patchController.path, patchController.content).pass,
    true,
  );
});

test('workflow authority rejects production deployment actions without a main-push gate', () => {
  const fixture = [
    'jobs:',
    '  deploy:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: cloudflare/wrangler-action@v4',
    '        with:',
    '          command: deploy --config wrangler.jsonc',
  ].join('\\n');

  const report = analyzeWorkflowAuthority('.github/workflows/fixture.yml', fixture);
  assert.equal(report.pass, false);
  assert.match(report.findings[0], /not gated to a push of refs\\/heads\\/main/u);
});

test('workflow-level contents:write must be explicitly constrained to main or execution', () => {
  const unauthorized = [
    'permissions:',
    '  contents: write',
    'jobs:',
    '  test:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - run: echo test',
  ].join('\\n');
  assert.equal(analyzeWorkflowAuthority('.github/workflows/fixture.yml', unauthorized).pass, false);

  const executionController = [
    'permissions:',
    '  contents: write',
    'jobs:',
    '  controller:',
    '    env:',
    '      FLIXO_TARGET_BRANCH: execution',
    '    steps:',
    '      - uses: actions/checkout@v5',
    '        with:',
    '          ref: execution',
  ].join('\\n');
  assert.equal(analyzeWorkflowAuthority('.github/workflows/fixture.yml', executionController).pass, true);
});
test('workflow authority rejects an unauthorized non-main production deployment', () => {
  const fixture = [
    'jobs:',
    '  deploy:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - run: wrangler deploy --config wrangler.jsonc',
  ].join('\n');

  const report = analyzeWorkflowAuthority('.github/workflows/fixture.yml', fixture);
  assert.equal(report.pass, false);
  assert.match(
    report.findings[0],
    /not gated to a push of refs\/heads\/main/u,
  );
});

test('quarantine set is explicit evidence, not an authorization namespace', () => {
  for (const ref of QUARANTINED_REFS) {
    assert.equal(classifyRef(ref).authority, 'quarantined-stale');
    assert.equal(classifyRef(ref).allowed, true);
    assert.equal(classifyRef(ref).quarantined, true);
  }
});
