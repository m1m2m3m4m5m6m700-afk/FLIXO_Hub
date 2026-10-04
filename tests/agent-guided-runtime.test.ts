import assert from 'node:assert/strict';
import { test } from 'node:test';

const { planAgentRequest, executeAgentPlan } = await import('../src/lib/agent-guided-runtime.ts');
const { MVP_EXECUTABLE_TOOL_IDS } = await import('../src/config/manual-capability-definition.ts');
const { getToolChainAdapter } = await import('../src/lib/tool-chain-adapters.ts');

const CASES: ReadonlyArray<readonly [string, string]> = [
  ['background-remover', 'remove the background'],
  ['image-upscaler', 'upscale this image'],
  ['image-cropper', 'crop this image to square'],
  ['image-compressor', 'compress my image'],
  ['image-converter', 'convert this image to webp'],
  ['image-effects', 'adjust image effects'],
  ['image-rotate', 'rotate the image'],
  ['image-flip-horizontal', 'flip horizontal'],
  ['image-flip-vertical', 'flip vertical'],
  ['image-brightness', 'increase brightness'],
  ['image-contrast', 'increase contrast by 10 percent'],
  ['image-saturation', 'increase saturation'],
  ['image-grayscale', 'make it black and white'],
  ['image-invert', 'invert image colors'],
  ['image-sepia', 'apply sepia'],
  ['image-blur', 'blur the image'],
  ['image-sharpen', 'sharpen the image'],
  ['image-resizer', 'resize the image'],
  ['image-hue', 'change the hue'],
  ['image-pixelate', 'pixelate the image'],
];

test('agent planner admits exactly twenty executable tools and binds every tool to a local adapter', () => {
  assert.equal(MVP_EXECUTABLE_TOOL_IDS.length, 20);
  assert.equal(CASES.length, 20);
  for (const [expectedToolId, request] of CASES) {
    assert.equal(MVP_EXECUTABLE_TOOL_IDS.includes(expectedToolId as never), true, expectedToolId);
    assert.equal(typeof getToolChainAdapter(expectedToolId), 'function', expectedToolId);
    const file = new File(['local-image'], 'fixture.png', { type: 'image/png' });
    const plan = planAgentRequest(request, file);
    assert.equal(plan.steps.length, 1);
    assert.equal(plan.steps[0].toolId, expectedToolId);
    assert.equal(plan.requiresUserConfirmation, true);
  }
});

test('agent execution fails closed without explicit confirmation', async () => {
  const file = new File(['local-image'], 'fixture.png', { type: 'image/png' });
  const plan = planAgentRequest('sharpen the image', file);
  await assert.rejects(
    () => executeAgentPlan(plan, file, false),
    /explicit user confirmation is required/i,
  );
});
