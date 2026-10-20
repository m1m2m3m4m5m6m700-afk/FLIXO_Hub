#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { submitMemoryProposal } from './shared-memory.mjs';

const REPORT_CENTER = 'الوكلاء/التقارير';
const PROPOSAL_RE = /^اقتراح-([A-Z]+-[0-9]{2,8})\.yaml$/;

const ROLE_TO_AGENT = Object.freeze({
  'AGENT-08 — Architecture Scout': { id: 'AGENT-08', role: 'architecture-research' },
  'AGENT-09 — Technology Scout': { id: 'AGENT-09', role: 'technology-research' },
  'AGENT-10 — Ecosystem Scout': { id: 'AGENT-10', role: 'ecosystem-research' },
});

function exactSha() {
  const envSha = process.env.GITHUB_SHA;
  const sha = envSha || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('INGEST_EXACT_SHA_REQUIRED');
  return sha.toLowerCase();
}

function canonicalReportFiles(root = REPORT_CENTER) {
  const files = [];
  for (const dir of Object.keys(ROLE_TO_AGENT)) {
    const full = join(root, dir);
    try {
      for (const name of readdirSync(full)) {
        if (!PROPOSAL_RE.test(name)) continue;
        files.push({ path: join(full, name), agent: ROLE_TO_AGENT[dir] });
      }
    } catch (error) {
      const code = error?.code;
      if (code === 'ENOENT') continue;
      throw error;
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

function parseStrictCandidate(path) {
  const text = readFileSync(path, 'utf8');
  if (!text.includes('status: candidate')) throw new Error(path + ': candidate lifecycle required');
  const json = execFileSync(process.execPath, [
    fileURLToPath(new URL('../run-python.mjs', import.meta.url)),
    '.agent-intelligence/scripts/parse-strict-proposal.py',
    path,
  ], { encoding: 'utf8' });
  const proposal = JSON.parse(json);
  return proposal;
}

async function main() {
  const sha = exactSha();
  const files = canonicalReportFiles();
  if (files.length === 0) {
    console.log(JSON.stringify({ status: 'PASS', sha, ingested: 0, reason: 'NO_CANDIDATE_REPORTS' }));
    return;
  }

  const results = [];
  for (const item of files) {
    const proposal = parseStrictCandidate(item.path);
    const rel = relative(process.cwd(), item.path).replaceAll('\\', '/');
    const expectedAgentId = item.agent.id;
    results.push(await submitMemoryProposal({
      agent: item.agent.id,
      agentId: expectedAgentId,
      role: item.agent.role,
      taskId: proposal.id,
      exactSha: sha,
      currentSha: sha,
      kind: proposal.category === 'security' ? 'WARNING' : 'LESSON',
      claim: proposal.title,
      title: proposal.title,
      content: JSON.stringify({
        proposalId: proposal.id,
        inference: proposal.inference,
        evidence: proposal.evidence,
        source: proposal.source,
      }),
      evidenceRefs: [rel],
      reportPath: rel,
      scopeJson: { repo_refs: proposal.inference?.current_state?.repo_refs ?? [] },
      metadata: {
        agent_id: expectedAgentId,
        proposal_id: proposal.id,
        report_path: rel,
      },
      provenance: {
        source: 'canonical-agent-report',
        report_path: rel,
        proposal_id: proposal.id,
      },
    }));
  }

  console.log(JSON.stringify({
    status: 'PASS',
    sha,
    ingested: results.length,
    results,
    promotion: 'DEFERRED_TO_INDEPENDENT_REVIEW_AND_RECONCILIATION',
  }, null, 2));
}

main().catch(error => {
  console.error('AGENT_LEARNING_INGEST_FAIL_CLOSED:', error?.message ?? error);
  process.exitCode = 1;
});
