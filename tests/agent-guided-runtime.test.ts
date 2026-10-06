import test from 'node:test';
import assert from 'node:assert/strict';

import { confirmAgentPlan, executeAgentPlan, planAgentRequest } from '../src/lib/agent-guided-runtime.ts';
import { MVP_EXECUTABLE_TOOL_IDS } from '../src/config/manual-capability-definition.ts';
import { TOOL_CATALOG } from '../src/config/registry.ts';

const image = () => new File(['not-a-real-image'], 'fixture.png', { type: 'image/png' });
const video = () => new File(['not-a-real-video'], 'fixture.webm', { type: 'video/webm' });

test('guided runtime is bounded to the current canonical ten-tool MVP', () => {
  assert.equal(MVP_EXECUTABLE_TOOL_IDS.length, 10);
  const plan = planAgentRequest('compress this image to webp', image());
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].toolId, 'image-compressor');
  assert.equal(plan.catalogFingerprint, TOOL_CATALOG.fingerprint);
  assert.equal(plan.requiresUserConfirmation, true);
  assert.equal(plan.matchedIntent, 'compress');
});

test('guided runtime reuses canonical intent and rejects unsupported capabilities', () => {
  const videoPlan = planAgentRequest('trim the video', video());
  assert.equal(videoPlan.steps[0].toolId, 'video-trimmer');
  assert.throws(
    () => planAgentRequest('remove the object from this image', image()),
    /No admitted FLIXO MVP capability/i,
  );
});

test('guided runtime requires a current one-time confirmation receipt', async () => {
  const file = image();
  const plan = planAgentRequest('compress this image', file);
  await assert.rejects(
    () => executeAgentPlan(plan, file, null),
    /confirmation receipt/i,
  );

  const receipt = confirmAgentPlan(plan, file);
  await assert.rejects(
    () => executeAgentPlan(plan, file, receipt),
  );
  await assert.rejects(
    () => executeAgentPlan(plan, file, receipt),
    /confirmation receipt is missing, stale/i,
  );
});


test('guided runtime preserves compound plans for canonical-chain execution', () => {
  const file = image();
  const plan = planAgentRequest('compress this image under 200KB and convert to WebP', file);
  assert.deepEqual(plan.steps.map((step) => step.toolId), ['image-converter', 'image-compressor']);
});

test('guided runtime cannot confirm a plan issued for another file', () => {
  const original = image();
  const other = image();
  const plan = planAgentRequest('compress this image', original);
  assert.throws(
    () => confirmAgentPlan(plan, other),
    /not issued by the current FLIXO Agent planner/i,
  );
});

test('guided runtime expires confirmation receipts and does not retain them indefinitely', async () => {
  const originalNow = Date.now;
  try {
    let now = 1_000_000;
    Date.now = () => now;
    const file = image();
    const plan = planAgentRequest('compress this image', file);
    const receipt = confirmAgentPlan(plan, file);
    now += 10 * 60 * 1000 + 1;
    await assert.rejects(
      () => executeAgentPlan(plan, file, receipt),
      /expired/i,
    );
  } finally {
    Date.now = originalNow;
  }
});
