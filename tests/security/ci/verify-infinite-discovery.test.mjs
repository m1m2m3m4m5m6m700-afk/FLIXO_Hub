import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/continuous-discovery.yml", "utf8").replace(/\r\n/gu, "\n");
const verifier = readFileSync("scripts/verify-infinite-discovery.mjs", "utf8").replace(/\r\n/gu, "\n");

test("discovery verifier and workflow agree on quoted Unicode report globs", () => {
  const reportGlobs = [
    {
      role: "Architecture",
      workflowGlob: '"الوكلاء/التقارير/AGENT-08 — Architecture Scout/"*.yaml',
      verifierFragment: 'AGENT-08 — Architecture Scout/"*.yaml',
    },
    {
      role: "Technology",
      workflowGlob: '"الوكلاء/التقارير/AGENT-09 — Technology Scout/"*.yaml',
      verifierFragment: 'AGENT-09 — Technology Scout/"*.yaml',
    },
    {
      role: "Ecosystem",
      workflowGlob: '"الوكلاء/التقارير/AGENT-10 — Ecosystem Scout/"*.yaml',
      verifierFragment: 'AGENT-10 — Ecosystem Scout/"*.yaml',
    },
  ];

  for (const { role, workflowGlob, verifierFragment } of reportGlobs) {
    assert.ok(workflow.includes(workflowGlob), `workflow is missing the quoted Unicode ${role} publication glob`);
    assert.ok(verifier.includes(verifierFragment), `verifier is not bound to the ${role} publication glob`);
  }
});

test("discovery workflow binds token use explicitly and scopes write permissions to publication", () => {
  const tokenBindings = workflow.match(/GITHUB_TOKEN:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/gu) ?? [];
  assert.ok(tokenBindings.length >= 2, "both repository-acquisition and publication steps must bind GITHUB_TOKEN explicitly");
  assert.match(workflow, /GH_TOKEN:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/u);
  assert.ok(verifier.includes("GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}"), "verifier must require explicit token binding");
  assert.ok(verifier.includes("https://x-access-token:$GITHUB_TOKEN@github.com/$GITHUB_REPOSITORY.git"), "verifier must require token-authenticated publication");

  const contractJob = workflow.split("\n  contract:\n")[1]?.split("\n  discover:\n")[0] ?? "";
  const discoverJob = workflow.split("\n  discover:\n")[1] ?? "";
  assert.match(contractJob, /permissions:\n      contents: read/u);
  assert.match(discoverJob, /permissions:\n      contents: write\n      pull-requests: write/u);
});

test("discovery publication remains fail-closed to execution intake and canonical output paths", () => {
  assert.match(workflow, /test "\$BASE_BRANCH" = "execution"/u);
  assert.match(workflow, /test "\$HEAD_REPO" = "\$REPOSITORY"/u);
  assert.match(workflow, /test "\$REF" = "refs\/heads\/execution"/u);
  assert.match(workflow, /--base execution/u);
  assert.match(workflow, /scout\/discovery-\$GITHUB_RUN_ID/u);
  assert.doesNotMatch(workflow, /git push origin (?:main|execution)\b/u);
  assert.doesNotMatch(workflow, /git add \.agent-intelligence\/inbox\b/u);
});

test("the discovery contract verifier passes against the checked-in workflow", () => {
  const output = execFileSync(process.execPath, ["scripts/verify-infinite-discovery.mjs"], { encoding: "utf8" });
  assert.match(output, /INFINITE_DISCOVERY=PASS/u);
});
