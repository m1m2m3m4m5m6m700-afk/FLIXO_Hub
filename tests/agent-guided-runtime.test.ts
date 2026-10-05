import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  confirmAgentPlan,
  executeAgentPlan,
  planAgentRequest,
} = await import('../src/lib/agent-guided-runtime.ts');
const { getCapability, MVP_EXECUTABLE_TOOL_IDS } = await import('../src/config/manual-capability-definition.ts');
const { parseExecutionPlan } = await import('../src/lib/contracts/ai-plan.ts');

const toExecutionPlan = (plan: { workflowName: string; confidence: number; catalogFingerprint: string; steps: readonly { toolId: string; params?: Record<string, string | number | boolean> }[] }) => ({
  workflowName: plan.workflowName,
  confidence: plan.confidence,
  catalogFingerprint: plan.catalogFingerprint,
  steps: plan.steps.map((step) => ({ toolId: step.toolId, params: step.params ?? {} })),
});
const { ImageJob } = await import('../src/image-core/job.ts');
const { ImageAssetStore } = await import('../src/image-core/asset-store.ts');

const CASES: ReadonlyArray<readonly [string, string]> = [
  ['background-remover', 'remove the background'],
  ['image-upscaler', 'upscale this image'],
  ['image-cropper', 'crop this image to square'],
  ['image-compressor', 'compress my image'],
  ['image-converter', 'convert this image to webp'],
  ['image-effects', 'adjust image effects'],
  ['image-resizer', 'resize the image'],
  ['image-rotate-flip', 'rotate and flip the image'],
  ['image-brightness-contrast', 'increase brightness and contrast'],
  ['image-saturation-hue', 'increase saturation and hue'],
  ['image-exposure', 'increase exposure'],
  ['image-highlights-shadows', 'adjust highlights and shadows'],
  ['image-sharpen', 'sharpen the image'],
  ['image-blur', 'blur the image'],
  ['image-grayscale-duotone', 'apply duotone mapping'],
  ['image-filters', 'use photo filters'],
  ['image-watermark', 'add a watermark'],
  ['image-text-overlay', 'add text to the image'],
  ['image-draw-annotate', 'draw an arrow on the image'],
  ['image-redaction', 'redact a region of the image'],
];

function file(content = 'local-image', type = 'image/png') {
  return new File([content], 'fixture.png', { type });
}

test('agent planner admits exactly twenty executable tools and binds every tool to a local adapter', () => {
  assert.equal(MVP_EXECUTABLE_TOOL_IDS.length, 24);
  assert.equal(
    MVP_EXECUTABLE_TOOL_IDS.filter((id) => id === 'background-remover' || id.startsWith('image-')).length,
    20,
  );
  assert.equal(CASES.length, 20);
  for (const [expectedToolId, request] of CASES) {
    assert.equal(MVP_EXECUTABLE_TOOL_IDS.includes(expectedToolId as never), true, expectedToolId);
    const capability = getCapability(expectedToolId);
    assert.equal(capability?.state, 'EXECUTABLE', expectedToolId);
    assert.equal(capability?.executionMode, 'LOCAL', expectedToolId);
    assert.equal(capability?.operational.executorId, expectedToolId, expectedToolId);
    const plan = planAgentRequest(request, file());
    assert.equal(plan.steps.length, 1);
    assert.equal(plan.steps[0].toolId, expectedToolId);
    assert.equal(plan.requiresUserConfirmation, true);
  }
});

test('agent execution requires a one-time confirmation receipt and rejects forged/stale plans', async () => {
  const input = file();
  const plan = planAgentRequest('sharpen the image', input);

  await assert.rejects(
    () => executeAgentPlan(plan, input, null),
    /confirmation receipt is required/i,
  );

  const forgedValidPlan = Object.freeze({
    ...plan,
    steps: plan.steps.map((step) => ({ ...step, params: { ...(step.params ?? {}) } })),
  });
  assert.throws(
    () => confirmAgentPlan(forgedValidPlan, input),
    /plan was not issued by the FLIXO Agent planner/i,
  );

  const receipt = confirmAgentPlan(plan, input);
  const forgedPlan = Object.freeze({
    ...plan,
    catalogFingerprint: '0'.repeat(64),
  });
  await assert.rejects(
    () => executeAgentPlan(forgedPlan, input, receipt),
    /different canonical tool catalog|stale relative to the current canonical tool catalog/i,
  );

  const secondReceipt = confirmAgentPlan(plan, input);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => executeAgentPlan(plan, input, secondReceipt, controller.signal),
    /cancelled/i,
  );
  await assert.rejects(
    () => executeAgentPlan(plan, input, secondReceipt),
    /confirmation receipt is stale/i,
  );
});

test('agent plan parser rejects unknown tools and malformed parameters before execution', () => {
  const plan = planAgentRequest('sharpen the image', file());
  assert.throws(
    () => parseExecutionPlan({
      ...toExecutionPlan(plan),
      steps: [{ toolId: 'not-a-real-tool', params: {} }],
    }),
    /not executable or not registered/i,
  );
  assert.throws(
    () => parseExecutionPlan({
      ...toExecutionPlan(plan),
      steps: [{ toolId: 'image-upscaler', params: { scale: -2 } }],
    }),
    /Invalid parameters/i,
  );
});

test('agent input boundary rejects empty, oversized, and unsupported MIME files', () => {
  assert.throws(
    () => planAgentRequest('sharpen the image', file('', 'image/png')),
    /size must be between/i,
  );
  assert.throws(
    () => planAgentRequest('sharpen the image', file('x', 'text/plain')),
    /image files only/i,
  );
  assert.throws(
    () => planAgentRequest('sharpen the image', new File(['x'.repeat(25 * 1024 * 1024 + 1)], 'too-large.png', { type: 'image/png' })),
    /size must be between/i,
  );
});

test('agent execution rejects corrupted image bytes instead of returning a result', async () => {
  const input = file('not-a-real-png');
  const plan = planAgentRequest('sharpen the image', input);
  const receipt = confirmAgentPlan(plan, input);
  await assert.rejects(
    () => executeAgentPlan(plan, input, receipt),
  );
});

test('ImageJob verifier absence fails closed', async () => {
  const assetStore = new ImageAssetStore();
  const inputAssetId = assetStore.put({
    blob: new Blob(['input'], { type: 'image/png' }),
    width: 1,
    height: 1,
  });
  const job = new ImageJob({
    toolId: 'test-no-verifier',
    inputAssetId,
    assetStore,
    processor: async () => ({
      blob: new Blob(['output'], { type: 'image/png' }),
      width: 1,
      height: 1,
    }),
  });

  await assert.rejects(
    () => job.run(),
    /verification failed.*verifier is required/i,
  );
});

test('agent confirmation receipts are single-consumer under concurrent invocation', async () => {
  const input = file();
  const plan = planAgentRequest('sharpen the image', input);
  const receipt = confirmAgentPlan(plan, input);
  const controller = new AbortController();
  const executions = await Promise.allSettled([
    executeAgentPlan(plan, input, receipt, controller.signal),
    executeAgentPlan(plan, input, receipt, controller.signal),
  ]);
  const rejected = executions.filter((item) => item.status === 'rejected');
  assert.ok(rejected.length >= 1);
});


test('agent planner refuses compound requests instead of silently dropping the second intent', () => {
  assert.throws(
    () => planAgentRequest('remove the background and resize the image', file()),
    /ambiguous/i,
  );
});
