#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SHA_RE = /^[0-9a-f]{40}$/i;
const CI_GATE_NAMES = Object.freeze([
  'KNOWLEDGE-CONSISTENCY','WORLD-MODEL-INTEGRITY','MEMORY-INTEGRITY',
  'MEMORY-SHA-FRESHNESS','LEARNING-ANTI-POISONING','FALSIFICATION-NETWORK','REPORT-ROUTING',
  'DISCOVERY-BOUNDARY','AGENT-BEHAVIOR','LEARNING-REGRESSION',
]);
const OPERATIONAL_GATES = Object.freeze([
  'COUNCIL-INTEGRATION','WAKE-LEASE-RECOVERY','PATCH-CAPSULE-CAS','EXACT-SHA-CLOSURE',
]);
export const CONTROL_ASSURANCE_B_GATES = Object.freeze([...CI_GATE_NAMES, ...OPERATIONAL_GATES]);

function gitHead(root = ROOT) {
  return execFileSync('git', ['rev-parse','HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}
function liveExecutionHead(root = ROOT) {
  const output = execFileSync('git', ['ls-remote','origin','refs/heads/execution'], { cwd: root, encoding: 'utf8' }).trim();
  return output.split(/\s+/u)[0] ?? '';
}
function read(root, path) {
  const full = join(root, path);
  if (!existsSync(full)) throw new Error('missing:' + path);
  return readFileSync(full, 'utf8');
}
function migrationCorpus(root) {
  const dir = join(root,'supabase','migrations');
  if (!existsSync(dir)) throw new Error('missing:supabase/migrations');
  return readdirSync(dir).filter(name => name.endsWith('.sql')).sort()
    .map(name => read(root,'supabase/migrations/' + name)).join('\n');
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function runGate(name, fn) {
  try { fn(); return { gate:name, status:'VERIFIED' }; }
  catch (error) { return { gate:name, status:'BLOCKED', reason:String(error?.message ?? error) }; }
}

export function evaluateControlAssuranceB({
  root = ROOT,
  currentSha = gitHead(root),
  expectedSha = process.env.EXPECTED_SHA || process.env.GITHUB_SHA || currentSha,
} = {}) {
  const workflow = read(root,'.github/workflows/continuous-discovery.yml');
  const verifier = read(root,'scripts/verify-infinite-discovery.mjs');
  const scouts = read(root,'.agent-intelligence/scripts/run_scouts.py');
  const proposalTests = read(root,'tests/agent-intelligence/test_discovery.py');
  const agents = read(root,'الوكلاء.md');
  const controlPlane = read(root,'scripts/agent-control-plane.mjs');
  const activityLedger = read(root,'scripts/agent-activity-ledger.mjs');
  const sharedMemory = read(root,'scripts/agent-learning/shared-memory.mjs');
  const learningControl = read(root,'scripts/agent-learning/self-learning-control-plane.mjs');
  const roleDrills = read(root,'scripts/agent-learning/run-role-drills.mjs');
  const controller = read(root,'scripts/ci/controller-reconcile-and-publish.mjs');
  const capsule = read(root,'scripts/ci/patch-capsule.mjs');
  const memoryWorkflow = read(root,'.github/workflows/agent-shared-memory-ingestion.yml');
  const controllerTest = read(root,'scripts/ci/test-controller-publication-contract.mjs');
  const migration = migrationCorpus(root);
  const results = [];

  results.push(runGate('EXACT-SHA-CLOSURE', () => {
    assert(SHA_RE.test(currentSha),'current execution HEAD is not exact');
    assert(!expectedSha || SHA_RE.test(expectedSha),'expected SHA is not exact');
    assert(currentSha.toLowerCase() === expectedSha.toLowerCase(),'tested SHA != current execution HEAD');
    if (process.env.GITHUB_ACTIONS === 'true') {
      const live = liveExecutionHead(root);
      assert(SHA_RE.test(live),'live execution ref did not resolve to an exact SHA');
      assert(live.toLowerCase() === currentSha.toLowerCase(),'live execution branch drifted during verification');
    }
    assert(!workflow.includes('refs/heads/main'),'discovery workflow contains main target');
  }));

  results.push(runGate('DISCOVERY-BOUNDARY', () => {
    const inbox = readdirSync(join(root,'.agent-intelligence','inbox')).filter(name => !['.gitkeep','README.md'].includes(name));
    assert(inbox.length === 0,'inbox contains unexpected artifacts: ' + inbox.join(','));
    assert(scouts.includes('canonical report center'),'Scout runtime must assert canonical report center');
    assert(verifier.includes('inbox is deny-only'),'discovery verifier must enforce deny-only inbox');
    assert(/\[\[ "\$EXECUTION_SHA" =~ \^\[0-9a-f\]\{40\}\$ \]\]/u.test(workflow),'invalid Bash SHA assertion');
    assert(workflow.includes('github.event.pull_request.base.ref') && workflow.includes("github.event_name == 'pull_request'"),'PR discovery contract not bound to execution');
  }));

  results.push(runGate('FALSIFICATION-NETWORK', () => {
    for (const path of [
      '.github/agents/red-team-1.md',
      '.github/agents/red-team-2.md',
      '.github/agents/المستكشف-2.md',
    ]) {
      const profile = read(root, path);
      assert(/independent_review:\s*true/u.test(profile), 'independent review must be enabled for ' + path);
      assert(/cap_WRITE_INBOX:\s*DENY/u.test(profile), 'challenge agent may not write to inbox: ' + path);
      assert(/cap_CERTIFY:\s*DENY/u.test(profile), 'challenge agent may not certify: ' + path);
    }
    for (const drill of ['independent-challenge','counterexample']) assert(roleDrills.includes(drill), 'falsification drill missing: ' + drill);
    assert(sharedMemory.includes('flixo_review_agent_memory'), 'shared-memory independent review RPC path missing');
    assert(sharedMemory.includes('p_regression_confirmed'), 'review must record regression confirmation');
  }));

  results.push(runGate('REPORT-ROUTING', () => {
    assert(scouts.includes('الوكلاء/التقارير'),'Scout runtime must route to central reports');
    assert(!/open\([^\n]*(?:\.agent-intelligence\/inbox|inbox)[^\n]*(?:["\x27]w|["\x27]a)/u.test(scouts),'Scout runtime contains inbox write route');
    for (const id of ['AGENT-08','AGENT-09','AGENT-10']) assert(workflow.includes('الوكلاء/التقارير/' + id),'missing canonical report publication for ' + id);
    assert(workflow.includes('scout/discovery-$GITHUB_RUN_ID'),'discovery publication must use isolated scout branch');
    assert(workflow.includes('GITHUB_TOKEN:') && workflow.includes('secrets.GITHUB_TOKEN'),'publication token must be explicit');
  }));

  results.push(runGate('EXPLORATION-SCHEDULER', () => {
    assert(workflow.includes('schedule:'), 'scheduled discovery is missing');
    assert(workflow.includes('17 2 * * *'), 'scheduled discovery cadence is missing');
    for (const role of ['AGENT-08','AGENT-09','AGENT-10']) assert(workflow.includes('الوكلاء/التقارير/' + role), 'scheduled Scout family route missing: ' + role);
    assert(workflow.includes('python3 .agent-intelligence/scripts/run_scouts.py'), 'scheduled discovery does not invoke canonical Scout runner');
    assert(workflow.includes('python3 .agent-intelligence/scripts/validate.py --all'), 'scheduled discovery does not validate proposals before publication');
  }));

  results.push(runGate('WORLD-MODEL-INTEGRITY', () => {
    for (const role of ['architecture','technology','ecosystem']) {
      const manifest = read(root,'.agent-intelligence/scouts/' + role + '.yaml');
      assert(manifest.includes('flixo-scout-manifest-v1'),'invalid ' + role + ' manifest');
      assert(/entity_key:/u.test(manifest),role + ' manifest missing entity identity');
      assert(/repo_refs:/u.test(manifest),role + ' manifest missing repo references');
      assert(/rollback:/u.test(manifest),role + ' manifest missing rollback');
    }
  }));

  results.push(runGate('KNOWLEDGE-CONSISTENCY', () => {
    assert(agents.includes('"officialAgentCount": 10'),'canonical registry must contain ten principal agents');
    assert(agents.includes('"id": "AGENT-06"') && agents.includes('"id": "AGENT-07"'),'Red Team agents missing');
    assert(agents.includes('"id": "SUPPORT-EXPLORER-02"'),'supporting Explorer missing');
    assert(!controlPlane.includes('main-mutation'),'control plane must not grant main mutation');
  }));

  results.push(runGate('MEMORY-INTEGRITY', () => {
    assert(sharedMemory.includes('searchSharedMemory'),'shared memory search missing');
    assert(sharedMemory.includes('reviewMemory'),'memory review path missing');
    assert(sharedMemory.includes('recordMemoryUsage'),'memory usage path missing');
    assert(sharedMemory.includes('reconcileMemory'),'memory reconcile path missing');
    assert(/الوكلاء\/التقارير/u.test(memoryWorkflow),'memory ingestion must consume canonical reports');
  }));

  results.push(runGate('MEMORY-SHA-FRESHNESS', () => {
    assert(sharedMemory.includes('preflightMemoryRetrieval'),'memory preflight missing');
    assert(sharedMemory.includes('STALE_EVIDENCE'),'stale memory classification missing');
    assert(sharedMemory.includes('retrieval_blocked: true'),'stale/unpromoted memory must be blocked');
    assert(learningControl.includes('candidate evidence is bound to a different SHA'),'lesson promotion must fail closed on SHA drift');
  }));

  results.push(runGate('LEARNING-ANTI-POISONING', () => {
    assert(/harmful_count|harmful/u.test(sharedMemory),'harmful memory usage must be tracked');
    assert(sharedMemory.includes('reviewerAgent') && sharedMemory.includes('p_reviewer_agent'),'independent reviewer identity boundary missing');
    assert(sharedMemory.includes('p_decision') && sharedMemory.includes('reviewMemory'),'independent memory review path missing');
    assert(learningControl.includes('independent review confirmation is required'),'promotion requires independent confirmation');
    assert(learningControl.includes('regression test'),'promotion requires regression test');
  }));

  results.push(runGate('AGENT-BEHAVIOR', () => {
    for (const drill of ['independent-challenge','counterexample','architecture-research','technology-research','ecosystem-research']) assert(roleDrills.includes(drill),'missing drill: ' + drill);
    assert(roleDrills.includes('staleEvidenceRejected: true'),'role drills must reject stale evidence');
    assert(controlPlane.includes('roleDrillRegistered'),'control plane must bind drills to registry');
  }));

  results.push(runGate('LEARNING-REGRESSION', () => {
    assert(proposalTests.includes('test_quote_unique_caps_large_unique_snapshot'),'quote length regression missing');
    assert(proposalTests.includes('test_quote_unique_avoids_repeated_prefix_and_preserves_raw_text'),'raw-vs-normalized evidence regression missing');
    assert(proposalTests.includes('test_report_root_must_be_canonical'),'report routing regression missing');
    assert(proposalTests.includes('test_inbox_is_deny_only'),'inbox denial regression missing');
    assert(controllerTest.includes('ALREADY_PUBLISHED_RECOVERY'),'stale/recovery reconciliation regression missing');
  }));

  results.push(runGate('COUNCIL-INTEGRATION', () => {
    for (const fn of ['council_claim_dispatch','council_ack_dispatch','council_heartbeat_dispatch','council_complete_dispatch']) assert(migration.includes('function public.' + fn),'Council function missing: ' + fn);
    assert(migration.includes('exact_sha'),'Council transitions must carry exact-SHA evidence');
    assert(migration.includes('FAILED'),'Council failure state must exist');
    assert(migration.includes('last_error'),'Council failures must preserve an RCA/error field');
    assert(migration.includes('HANDOFF_READY'),'Council handoff state missing');
  }));

  results.push(runGate('WAKE-LEASE-RECOVERY', () => {
    assert(migration.includes('council_recover_expired_dispatches'),'lease recovery function missing');
    assert(migration.includes('cron.schedule'),'pg_cron schedule missing');
    assert(migration.includes('flixo-council-lease-recovery'),'lease recovery cron job missing');
    assert(migration.includes('flixo_retry_pending_assistant_wakes'),'wake retry path missing');
    assert(migration.includes('flixo_auto_wake_stale_master3'),'stale wake recovery missing');
    assert(!existsSync(join(root,'scripts/agent-wake-daemon')),'new wake daemon authority must not exist');
  }));

  results.push(runGate('PATCH-CAPSULE-CAS', () => {
    assert(capsule.includes('FLIXO-PATCH-CAPSULE-v1'),'patch capsule protocol missing');
    assert(controller.includes("const BRANCH = 'execution'"),'controller must target execution only');
    assert(controller.includes('async function liveHead'),'controller must resolve live execution HEAD');
    assert(controller.includes('CONTROLLER_CAS_CONFLICT'),'controller must fail on stale target SHA');
    assert(controller.includes('CONTROLLER_CAS_CONFLICT_BEFORE_PERSIST'),'controller must revalidate before persistence');
    assert(controller.includes('HEAD:refs/heads/') && controller.includes('BRANCH'),'controller must publish only to execution');
    assert(controller.includes('porcelain=v1') && controller.includes("'-z'"),'controller must use NUL-delimited status parsing');
    assert(!controller.includes('--force-with-lease') && !controller.includes("['--force'"),'controller may not force-push');
    assert(!/refs\/heads\/main/u.test(controller),'controller may not target main');
  }));

  results.push(runGate('OBSERVABILITY', () => {
    const corpus = [activityLedger,controlPlane,sharedMemory,roleDrills].join('\n');
    for (const token of ['agentId','taskId','shaBefore','shaAfter','heartbeat','lease','preflightMemoryRetrieval','EXPERIENCE']) assert(corpus.includes(token),'observability token missing: ' + token);
  }));

  results.push(runGate('AGENT-MASTERY', () => {
    for (const token of ['contractScore','behavioralEvidence','evaluateLessonPromotion','counterexample','regressionTest']) assert(learningControl.includes(token) || roleDrills.includes(token),'mastery signal missing: ' + token);
  }));

  assert(results.length === 15,'internal B gate inventory mismatch');
  return {
    currentSha,
    expectedSha,
    gates: results,
    passed: results.every(result => result.status === 'VERIFIED'),
    verifiedGateCount: results.filter(result => result.status === 'VERIFIED').length,
    totalGateCount: results.length,
  };
}

function main() {
  const currentSha = gitHead(ROOT);
  const expectedSha = process.env.EXPECTED_SHA || process.env.GITHUB_SHA || currentSha;
  const report = evaluateControlAssuranceB({ root:ROOT, currentSha, expectedSha });
  console.log(JSON.stringify(report,null,2));
  if (!report.passed) process.exitCode = 1;
}
if (process.argv[1]?.endsWith('verify-control-assurance-b.mjs')) main();
