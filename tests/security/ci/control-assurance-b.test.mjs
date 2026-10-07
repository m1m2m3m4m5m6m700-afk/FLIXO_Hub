import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { parsePorcelainV1ZStatus } from '../../scripts/ci/controller-reconcile-and-publish.mjs';
import { evaluateControlAssuranceB, CONTROL_ASSURANCE_B_GATES } from '../../scripts/ci/verify-control-assurance-b.mjs';

function head() {
  return execFileSync('git', ['rev-parse','HEAD'], { encoding:'utf8' }).trim();
}
function show(path) {
  return execFileSync('git', ['show','HEAD:' + path], { encoding:'utf8' });
}

test('B CONTROL ASSURANCE: all blocking gates pass on the current exact execution SHA', () => {
  const sha = head();
  const report = evaluateControlAssuranceB({ currentSha:sha, expectedSha:sha });
  assert.equal(report.passed, true, JSON.stringify(report, null, 2));
  assert.equal(report.totalGateCount, 15);
  assert.equal(report.verifiedGateCount, 15);
  assert.deepEqual(report.gates.map(g => g.gate), [...CONTROL_ASSURANCE_B_GATES]);
});

test('B12 legacy inbox routing remains blocked', () => {
  const workflow = show('.github/workflows/continuous-discovery.yml');
  const scout = show('.agent-intelligence/scripts/run_scouts.py');
  assert.doesNotMatch(workflow, /git add \.agent-intelligence\/inbox\b/u);
  assert.doesNotMatch(scout, /\.agent-intelligence\/inbox.*(?:open|write|append)/isu);
});

test('B12 invalid Bash SHA assertion regression is locked', () => {
  const workflow = show('.github/workflows/continuous-discovery.yml');
  assert.match(workflow, /\[\[ "\$EXECUTION_SHA" =~ \^\[0-9a-f\]\{40\}\$ \]\]/u);
  assert.doesNotMatch(workflow, /test\s+"\$EXECUTION_SHA"\s*=~\s*/u);
});

test('B12 duplicate evidence and raw-vs-normalized regression remain locked', () => {
  const source = show('.agent-intelligence/scripts/run_scouts.py');
  const tests = show('tests/agent-intelligence/test_discovery.py');
  assert.match(source, /raw\.count\(candidate\)\s*==\s*1/u);
  assert.match(tests, /test_quote_unique_avoids_repeated_prefix_and_preserves_raw_text/u);
});

test('B12 quote length above 8192 is rejected', () => {
  const tests = show('tests/agent-intelligence/test_discovery.py');
  assert.match(tests, /assertLessEqual\(len\(quote\),8192\)/u);
});

test('B12 rollback reversibility remains mandatory', () => {
  const verifier = show('scripts/verify-infinite-discovery.mjs');
  assert.match(verifier, /missing source field.*rollback|empty rollback/isu);
});

test('B12 Unicode Git path escaping is parsed from raw NUL-delimited status', () => {
  const raw = ' M الوكلاء/التقارير/إثبات-é.md\0';
  assert.deepEqual(parsePorcelainV1ZStatus(raw), ['الوكلاء/التقارير/إثبات-é.md']);
});

test('B12 Unicode rename status preserves both paths', () => {
  const raw = 'R  الوكلاء/التقارير/قديم-é.md\0الوكلاء/التقارير/جديد-é.md\0';
  assert.deepEqual(parsePorcelainV1ZStatus(raw), ['الوكلاء/التقارير/قديم-é.md','الوكلاء/التقارير/جديد-é.md']);
});

test('B12 publication authentication is explicit and execution-only', () => {
  const workflow = show('.github/workflows/continuous-discovery.yml');
  assert.match(workflow, /GITHUB_TOKEN:\s+\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/u);
  assert.match(workflow, /x-access-token:\$GITHUB_TOKEN@github\.com\/\$GITHUB_REPOSITORY\.git/u);
  assert.doesNotMatch(workflow, /git push origin (?:main|execution)\b/u);
});

test('B12 stale exact-SHA reconcile regression remains locked', () => {
  const controller = show('scripts/ci/controller-reconcile-and-publish.mjs');
  assert.match(controller, /async function liveHead/u);
  assert.match(controller, /CONTROLLER_CAS_CONFLICT/u);
  assert.match(controller, /CONTROLLER_POST_PUSH_HEAD_MISMATCH/u);
});

test('B12 wrong workflow trigger coverage is fail-closed', () => {
  const workflow = show('.github/workflows/continuous-discovery.yml');
  assert.match(workflow, /test "\$EVENT_NAME" = "pull_request"/u);
  assert.match(workflow, /BASE_BRANCH/u);
  assert.match(workflow, /github\.event_name != 'pull_request'/u);
});
