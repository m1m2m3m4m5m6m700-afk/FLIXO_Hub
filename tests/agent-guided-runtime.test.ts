import assert from 'node:assert/strict';
import test from 'node:test';

const { planAgentRequest, executeAgentPlan } = await import('../src/lib/agent-guided-runtime.ts');
const { CANONICAL_IMAGE_TOOL_IDS } = await import('../src/lib/canonical-image-executor.ts');

const CASES: ReadonlyArray<readonly [string,string]> = [
  ['background-remover','remove the background'],
  ['image-upscaler','upscale this image'],
  ['image-cropper','crop this image'],
  ['image-compressor','compress my image'],
  ['image-converter','convert this image to webp'],
  ['image-effects','apply image effects'],
  ['image-resizer','resize the image'],
  ['image-rotate-flip','rotate and flip the image'],
  ['image-brightness-contrast','brightness contrast'],
  ['image-saturation-hue','saturation hue'],
  ['image-exposure','adjust exposure'],
  ['image-highlights-shadows','highlights and shadows'],
  ['image-sharpen','sharpen image'],
  ['image-blur','blur image'],
  ['image-grayscale-duotone','grayscale duotone'],
  ['image-filters','image filter preset'],
  ['image-watermark','add watermark'],
  ['image-text-overlay','add text to image'],
  ['image-draw-annotate','draw on image'],
  ['image-redaction','redact image'],
];

function imageFile(name = 'fixture.png') {
  return new File(['local-image'], name, { type: 'image/png' });
}

test('agent planner admits exactly the twenty grouped image capabilities', async () => {
  assert.equal(CANONICAL_IMAGE_TOOL_IDS.length, 20);
  assert.equal(CASES.length, 20);
  for (const [expectedToolId, prompt] of CASES) {
    let plan;
    try {
      plan = await planAgentRequest(prompt, imageFile());
    } catch (error) {
      throw new Error(`planner failed for "${prompt}" expected="${expectedToolId}": ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
    assert.equal(plan.steps.length, 1);
    assert.equal(plan.steps[0].toolId, expectedToolId);
    assert.equal(plan.requiresUserConfirmation, true);
    assert.equal(plan.matchedIntent.length > 0, true);
    assert.equal(plan.confirmationToken.split('.').length, 3);
    assert.equal(plan.securityContext.catalogFingerprint, plan.catalogFingerprint);
    assert.equal(plan.securityContext.taskId.length > 0, true);
    assert.equal(plan.securityContext.documentFingerprint.length, 64);
    assert.equal(plan.securityContext.planFingerprint.length, 64);
  }
});

test('agent execution fails closed without explicit confirmation', async () => {
  const file = imageFile();
  const plan = await planAgentRequest('sharpen image', file);
  await assert.rejects(
    () => executeAgentPlan(plan, file, false),
    /explicit user confirmation is required/i,
  );
});

test('agent execution rejects a changed document before canonical execution', async () => {
  const plan = await planAgentRequest('sharpen image', imageFile());
  const changedFile = new File(['changed-image'], 'different.png', { type: 'image/png' });
  await assert.rejects(
    () => executeAgentPlan(plan, changedFile, true),
    /AGENT_DOCUMENT_STATE_CHANGED|plan changed after confirmation|Execution denied/i,
  );
});

test('agent execution rejects a forged plan even with the original confirmation token', async () => {
  const file = imageFile();
  const plan = await planAgentRequest('sharpen image', file);
  const forgedPlan = Object.freeze({
    ...plan,
    steps: [{ toolId: 'image-redaction', params: { x: 25, y: 25, width: 50, height: 25, color: '#000000' } }],
  });
  await assert.rejects(
    () => executeAgentPlan(forgedPlan, file, true),
    /plan changed after confirmation|CONFIRMATION_TOKEN_INVALID|Execution denied/i,
  );
});

test('agent execution never imports or calls tool-chain adapters directly', async () => {
  const module = await import('node:fs/promises');
  const source = await module.readFile(new URL('../src/lib/agent-guided-runtime.ts', import.meta.url), 'utf8');
  assert.equal(source.includes('executeToolChain'), false);
  assert.equal(source.includes("from './tool-chain-adapters'"), false);
});

test('agent planner rejects non-image and oversized files before planning', async () => {
  await assert.rejects(
    () => planAgentRequest('sharpen image', new File(['pdf'], 'x.pdf', { type: 'application/pdf' })),
    /accepts image files only/i,
  );
  const oversized = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' });
  await assert.rejects(
    () => planAgentRequest('sharpen image', oversized),
    /between 1 byte and 25 MB/i,
  );
});
