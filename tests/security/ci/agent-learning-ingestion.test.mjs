import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('shared-memory ingestion is report-only and fail-closed', () => {
  const script = readFileSync('scripts/agent-learning/ingest-report-learning.mjs', 'utf8');
  const workflow = readFileSync('.github/workflows/agent-shared-memory-ingestion.yml', 'utf8');
  assert.match(script, /الوكلاء\/التقارير/u);
  assert.match(script, /اقتراح-/u);
  assert.doesNotMatch(script, /\.agent-intelligence\/inbox/u);
  assert.match(script, /submitMemoryProposal/u);
  assert.match(script, /DEFERRED_TO_INDEPENDENT_REVIEW_AND_RECONCILIATION/u);
  assert.match(workflow, /Checkout exact triggering SHA|Checkout exact triggering SHA/u);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$\{GITHUB_SHA\}"/u);
  assert.match(workflow, /SUPABASE_SERVICE_ROLE_KEY/u);
});
