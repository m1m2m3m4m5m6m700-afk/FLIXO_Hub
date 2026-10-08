import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '../..');
const WF = path.join(ROOT, '.github', 'workflows');
const OWNER = 'm1m2m3m4m5m6m700-afk';
const names = () => fs.readdirSync(WF).filter((n) => /\.ya?ml$/i.test(n)).sort();
const read = (n) => fs.readFileSync(path.join(WF, n), 'utf8');
const checkouts = (t) => t.split(/\n(?=\s{6}-\s)/).filter((b) => /uses:\s*actions\/checkout@/.test(b));
const executionPush = (t) => /push:\s*[\s\S]{0,500}?branches:\s*\[[^\]]*\bexecution\b[^\]]*\]/.test(t);
test('CI_SECURITY_CONTRACTS: every checkout explicitly disables credential persistence', () => {
  for (const n of names()) for (const b of checkouts(read(n))) {
    assert.match(b, /persist-credentials:\s*false/, n);
    assert.doesNotMatch(b, /persist-credentials:\s*true/, n);
  }
});
test('EXECUTION_CREDENTIAL_ISOLATION: execution write authority is bounded', () => {
  for (const n of names()) { const t = read(n); if (!executionPush(t) || !/contents:\s*write/.test(t)) continue;
    assert.ok(n === 'continuous-discovery.yml' || n === 'triage-and-clean.yml', n);
    if (n === 'continuous-discovery.yml') {
      assert.match(t, /scout\/discovery-\$GITHUB_RUN_ID/);
      assert.match(t, /الوكلاء\/التقارير\/AGENT-08 — Architecture Scout/);
      assert.match(t, /\.agent-intelligence\/snapshots/);
      assert.doesNotMatch(t, /secrets\.[A-Z0-9_]+/);
    }
    if (n === 'triage-and-clean.yml') { assert.match(t, /HEAD:execution/); assert.match(t, /git diff --name-only/); assert.match(t, /review-queue|graveyard|handoffs/); }
  }
});
test('PRIVILEGED_DISPATCH: write-capable workflow_dispatch is actor/repository/ref gated', () => {
  for (const n of names()) { const t = read(n); if (!/workflow_dispatch:/.test(t) || !/contents:\s*write/.test(t)) continue;
    assert.match(t, /GITHUB_REPOSITORY|github\.repository/); assert.match(t, new RegExp(OWNER)); assert.match(t, /GITHUB_REF|GITHUB_REF_NAME|github\.ref/);
  }
});
test('EXACT_SHA_CONTRACT: candidate-sensitive workflows verify HEAD', () => {
  for (const n of names()) { const t = read(n); if (!(executionPush(t) || /pull_request:\s*[\s\S]{0,500}?branches:\s*\[[^\]]*\bmain\b/.test(t))) continue;
    for (const b of checkouts(t)) assert.match(b, /persist-credentials:\s*false/);
    if (n !== 'release-drafter.yml') assert.match(t, /git rev-parse HEAD/, n);
  }
});
test('SHARED_MEMORY_DISPATCH_GATE: secret-bearing shared-memory dispatch is actor/ref/repository gated', () => {
  const t = read('agent-shared-memory-ingestion.yml');
  assert.match(t, /workflow_dispatch:/);
  assert.match(t, /github\.event_name == 'workflow_dispatch'/);
  assert.match(t, /github\.repository == 'm1m2m3m4m5m6m700-afk\/FLIXO_Hub'/);
  assert.match(t, /github\.ref == 'refs\/heads\/execution'/);
  assert.match(t, /github\.actor == 'm1m2m3m4m5m6m700-afk'/);
  assert.match(t, /secrets\.SUPABASE_SERVICE_ROLE_KEY/);
});
test('SECRET_ISOLATION_AND_REGRESSION: provider secrets stay off generic execution', () => {
  for (const n of names()) {
    const t = read(n);
    if (!executionPush(t) || n === 'patch-capsule-controller.yml') continue;
    assert.doesNotMatch(t, /secrets\.(?:SUPABASE|TESTSPRITE)/i, n);
  }
  const p = read('patch-capsule-controller.yml');
  assert.match(p, /ref: main/u);
  assert.match(p, /FLIXO_TARGET_BRANCH: execution/u);
  assert.match(p, /secrets\.GITHUB_TOKEN/u);
  assert.match(p, /secrets\.SUPABASE_URL/u);
  assert.doesNotMatch(p, /push:\s*[\s\S]{0,160}?branches:\s*\[?execution\]?/u);
});
function runBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^\s*run:\s*\|/.test(lines[i])) continue;
    const indent = (lines[i].match(/^\s*/) || [''])[0].length;
    const block = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const nextIndent = (lines[j].match(/^\s*/) || [''])[0].length;
      if (lines[j].trim() !== '' && nextIndent <= indent) break;
      block.push(lines[j]);
    }
    blocks.push(block.join('\n'));
  }
  return blocks;
}

test('UNTRUSTED_PAYLOAD_AND_DISPATCH_REGRESSION: hostile event data never enters shell source', () => {
  const hostile = ['${' + '{ github.event.issue.body }}','${' + '{ github.event.comment.body }}','${' + '{ github.event.pull_request.title }}','${' + '{ inputs.proposal }}'];
  for (const n of names()) {
    const t = read(n);
    for (const block of runBlocks(t)) for (const x of hostile) assert.equal(block.includes(x), false, n + ': hostile interpolation in run block');
    assert.doesNotMatch(t, /^\s*repository_dispatch:/m, n);
  }
});
test('PRIVILEGE_REGRESSIONS_AND_DEPLOYMENT: workflow enable is absent and execution cannot deploy prod', () => {
  for (const n of names()) { const t = read(n); assert.doesNotMatch(t, /actions:\s*write/); assert.doesNotMatch(t, /workflow[_-]?enable|enable-workflow/i);
    if (!executionPush(t) || !/(?:wrangler|vercel).*deploy|Deploy exact SHA/i.test(t)) continue;
    if (n === 'ui-preview.yml') { assert.match(t, /PREVIEW_WORKER_NAME:\s*flixoai-preview/); assert.doesNotMatch(t, /(?:^|\s)--prod\b|flixoai-production|production-deploy/i); }
    else if (n === 'ci.yml') assert.match(t, /github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
    else assert.fail(n + ': execution deployment path is not bounded');
  }
});
test('RUNNER_WATCHDOG_CONTRACT: current watchdog surfaces are present after integration', () => {
  const required = [
    ['watchdog/package.json', /@flixo\/agent-watchdog/u],
    ['watchdog/src/lib/runtime.ts', /loadConfig[\s\S]*authAgent/u],
    ['watchdog/test/contract.test.ts', /AUTH_FAIL_CLOSED=PASS/u],
    ['src/lib/cell/watchdog.ts', /startCellWatchdog[\s\S]*timedOut/u],
  ];
  for (const [rel, marker] of required) {
    const abs = path.join(ROOT, rel);
    assert.ok(fs.existsSync(abs), rel + ' must exist after its lane merge');
    assert.match(fs.readFileSync(abs, 'utf8'), marker, rel);
  }
});
test('NO_SECOND_AUTHORITY_AND_CODEOWNERS: canonical authority is not redefined', () => {
  for (const r of [path.join(ROOT,'watchdog'),path.join(ROOT,'src','lib','cell')]) if (fs.existsSync(r)) for (const x of fs.readdirSync(r,{recursive:true}).map(String).filter((x)=>/\.(?:mjs|js|ts)$/i.test(x))) {
    const t=fs.readFileSync(path.join(r,x),'utf8'); assert.doesNotMatch(t,/\b(?:TOOL_REGISTRY|TOOL_CATALOG|executeCanonicalTool)\b/);
  }
  const c=fs.readFileSync(path.join(ROOT,'.github','CODEOWNERS'),'utf8');
  assert.match(c,new RegExp('^/watchdog/\\s+@'+OWNER+'$','m')); assert.match(c,new RegExp('^/src/lib/cell/\\s+@'+OWNER+'$','m'));
});