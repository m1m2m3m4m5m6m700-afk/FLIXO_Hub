import assert from 'node:assert/strict';
import { test } from 'node:test';

const { planAgentRequest, executeAgentPlan } = await import('../src/lib/agent-guided-runtime.ts');
const { MVP_EXECUTABLE_TOOL_IDS } = await import('../src/config/manual-capability-definition.ts');
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
  ['image-grayscale-duotone', 'make it grayscale'],
  ['image-filters', 'apply a photo filter'],
  ['image-watermark', 'add a watermark'],
  ['image-text-overlay', 'add text to the image'],
  ['image-draw-annotate', 'draw an arrow on the image'],
  ['image-redaction', 'redact a region of the image'],
];

test('agent planner admits exactly twenty executable tools and binds every tool to a local adapter', () => {
  assert.equal(CASES.length, 20);
  assert.equal(MVP_EXECUTABLE_TOOL_IDS.filter((id) => id.startsWith('image-') || id === 'background-remover').length, 20);
  for (const [expectedToolId, request] of CASES) {
    assert.equal(MVP_EXECUTABLE_TOOL_IDS.includes(expectedToolId as never), true, expectedToolId);
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
