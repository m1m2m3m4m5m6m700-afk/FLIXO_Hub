import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOOL_CATALOG } from '../src/config/registry.ts';
import {
  CANONICAL_IMAGE_TOOL_IDS,
  assertTargetLayersUnlocked,
  createImageExecutionConfirmationToken,
  validateCanonicalImageExecutionRequest,
  fingerprintImageExecutionPlan,
} from '../src/lib/canonical-image-executor.ts';
import { planImageToolIntent } from '../src/lib/image-agent-workflow.ts';

const IDS = [
  'background-remover','image-upscaler','image-cropper','image-compressor','image-converter',
  'image-effects','image-resizer','image-rotate-flip','image-brightness-contrast','image-saturation-hue',
  'image-exposure','image-highlights-shadows','image-sharpen','image-blur','image-grayscale-duotone',
  'image-filters','image-watermark','image-text-overlay','image-draw-annotate','image-redaction',
] as const;

test('canonical registry contains all 20 grouped image tools', () => {
  assert.deepEqual([...CANONICAL_IMAGE_TOOL_IDS], IDS);
  assert.equal(new Set(CANONICAL_IMAGE_TOOL_IDS).size, 20);
  for (const id of IDS) {
    const tool = TOOL_CATALOG.byId.get(id);
    assert.ok(tool, id);
    assert.equal(tool.capability.state, 'EXECUTABLE');
    assert.equal(tool.executionMode, 'LOCAL');
    assert.equal(tool.requirements.network, false);
    assert.equal(tool.operational.executorId, id);
    assert.equal(tool.operational.outputContractId, id);
    assert.equal(tool.safetyContract.rawBlobEgress, false);
    assert.equal(tool.safetyContract.allowLockedLayerSelection, false);
    assert.equal(tool.safetyContract.requiresUserConfirmationForAgent, true);
    assert.ok(tool.verifier);
  }
});

test('20/20 natural-language image intents select the expected canonical tool', () => {
  const cases = [
    ['remove background','background-remover'],
    ['upscale image','image-upscaler'],
    ['crop image','image-cropper'],
    ['compress image','image-compressor'],
    ['convert this image to webp','image-converter'],
    ['photo effects','image-effects'],
    ['resize image','image-resizer'],
    ['rotate and flip image','image-rotate-flip'],
    ['brightness contrast','image-brightness-contrast'],
    ['saturation hue','image-saturation-hue'],
    ['exposure adjustment','image-exposure'],
    ['highlights and shadows','image-highlights-shadows'],
    ['sharpen image','image-sharpen'],
    ['blur image','image-blur'],
    ['grayscale duotone','image-grayscale-duotone'],
    ['photo filter preset','image-filters'],
    ['add watermark','image-watermark'],
    ['add text to image','image-text-overlay'],
    ['draw on image','image-draw-annotate'],
    ['redact image','image-redaction'],
  ] as const;

  for (const [intent, expected] of cases) {
    const planned = planImageToolIntent(intent);
    assert.equal(planned.status, 'PLANNED', intent);
    assert.equal(planned.toolId, expected, intent);
    assert.equal(planned.confirmationRequired, true);
    assert.ok(planned.plan?.catalogFingerprint);
  }
});

test('locked layers and unknown tools fail closed', async () => {
  assert.throws(
    () => assertTargetLayersUnlocked(['layer-1'], [{ id: 'layer-1', locked: true }]),
    /LOCKED_LAYER_EXECUTION_REJECTED/,
  );
  assert.throws(
    () => assertTargetLayersUnlocked(['missing'], [{ id: 'layer-1', locked: false }]),
    /TARGET_LAYER_NOT_FOUND/,
  );

  await assert.rejects(
    validateCanonicalImageExecutionRequest({
      toolId: 'forged-tool',
      inputBlob: new Blob(['x'], { type: 'application/pdf' }),
      origin: 'manual',
    }),
    /UNKNOWN_TOOL/,
  );
});

test('agent confirmation cannot be omitted and confirmation payload is bound to a plan fingerprint', async () => {
  const plan = planImageToolIntent('redact image');
  assert.equal(plan.status, 'PLANNED');
  assert.ok(plan.plan);

  const planFingerprint = await fingerprintImageExecutionPlan(plan.plan);
  const securityContext = {
    taskId: 'task-redteam-1',
    taskRevision: 1,
    documentRevision: 1,
    documentFingerprint: 'a'.repeat(64),
    planFingerprint,
    catalogFingerprint: TOOL_CATALOG.fingerprint,
    expiresAt: Date.now() + 60_000,
  } as const;

  const token = await createImageExecutionConfirmationToken(
    plan.toolId!,
    plan.plan.steps[0].params ?? {},
    [],
    securityContext,
  );

  assert.equal(token.split('.').length, 3);
  assert.notEqual(
    token,
    await createImageExecutionConfirmationToken(
      plan.toolId!,
      plan.plan.steps[0].params ?? {},
      [],
      securityContext,
    ),
  );

  await assert.rejects(
    validateCanonicalImageExecutionRequest({
      toolId: plan.toolId!,
      inputBlob: new Blob(['corrupt'], { type: 'image/png' }),
      parameters: plan.plan.steps[0].params ?? {},
      origin: 'agent',
      confirmed: false,
    }),
    /CONFIRMATION_REQUIRED/,
  );
});

test('cancellation fails closed before image decoding', async () => {
  const controller = new AbortController();
  controller.abort(new DOMException('cancelled', 'AbortError'));
  await assert.rejects(
    validateCanonicalImageExecutionRequest({
      toolId: 'image-redaction',
      inputBlob: new Blob(['corrupt'], { type: 'image/png' }),
      parameters: { x: 25, y: 25, width: 50, height: 25, color: '#000000' },
      origin: 'manual',
      signal: controller.signal,
    }),
    /Abort|cancel/i,
  );
});

test('agent confirmation token is one-time and expires', async () => {
  const originalBitmap = (globalThis as typeof globalThis & { createImageBitmap?: unknown }).createImageBitmap;
  (globalThis as typeof globalThis & { createImageBitmap?: unknown }).createImageBitmap = async () => ({
    width: 32,
    height: 32,
    close() {},
  });

  try {
    const plan = planImageToolIntent('redact image');
    assert.equal(plan.status, 'PLANNED');
    assert.ok(plan.plan);
    const context = {
      taskId: 'task-replay',
      taskRevision: 1,
      documentRevision: 1,
      documentFingerprint: 'c'.repeat(64),
      planFingerprint: await fingerprintImageExecutionPlan(plan.plan),
      catalogFingerprint: TOOL_CATALOG.fingerprint,
      expiresAt: Date.now() + 60_000,
    } as const;
    const token = await createImageExecutionConfirmationToken(
      plan.toolId!,
      plan.plan.steps[0].params ?? {},
      [],
      context,
    );
    const input = new Blob(['image'], { type: 'image/png' });

    await validateCanonicalImageExecutionRequest({
      toolId: plan.toolId!,
      inputBlob: input,
      parameters: plan.plan.steps[0].params ?? {},
      origin: 'agent',
      confirmed: true,
      confirmationToken: token,
      securityContext: context,
    });

    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId: plan.toolId!,
        inputBlob: input,
        parameters: plan.plan.steps[0].params ?? {},
        origin: 'agent',
        confirmed: true,
        confirmationToken: token,
        securityContext: context,
      }),
      /CONFIRMATION_TOKEN_REPLAYED/,
    );

    const expiredContext = { ...context, taskId: 'task-expired', expiresAt: Date.now() - 1 };
    const expiredToken = await createImageExecutionConfirmationToken(
      plan.toolId!,
      plan.plan.steps[0].params ?? {},
      [],
      { ...expiredContext, expiresAt: Date.now() + 60_000 },
    );
    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId: plan.toolId!,
        inputBlob: input,
        parameters: plan.plan.steps[0].params ?? {},
        origin: 'agent',
        confirmed: true,
        confirmationToken: expiredToken,
        securityContext: expiredContext,
      }),
      /CONFIRMATION_EXPIR|CONFIRMATION_TOKEN_EXPIRED|AGENT_CONFIRMATION_EXPIRY_INVALID/,
    );
  } finally {
    (globalThis as typeof globalThis & { createImageBitmap?: unknown }).createImageBitmap = originalBitmap;
  }
});
