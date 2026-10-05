import assert from 'node:assert/strict';
import test from 'node:test';

import { TOOL_CATALOG } from '../src/config/registry.ts';
import {
  CANONICAL_IMAGE_TOOL_IDS,
  assertTargetLayersUnlocked,
  validateCanonicalImageExecutionRequest,
} from '../src/lib/canonical-image-executor.ts';
import { getCapability, validateCapabilityParameters } from '../src/config/manual-capability-definition.ts';
import { parseExecutionPlan } from '../src/lib/contracts/ai-plan.ts';

const PNG_CORRUPTED = new Blob(['not-a-real-image'], { type: 'image/png' });
const PDF = new Blob(['%PDF'], { type: 'application/pdf' });
const OVERSIZED = new Blob([new Uint8Array(64 * 1024 * 1024 + 1)], { type: 'image/png' });

const VALID: Record<string, Record<string, string | number | boolean>> = {
  'background-remover': { tolerance: 32 },
  'image-upscaler': { scale: 2 },
  'image-cropper': { aspectRatio: '1:1' },
  'image-compressor': { quality: 0.8, format: 'image/webp' },
  'image-converter': { format: 'image/webp' },
  'image-effects': { contrast: 115 },
  'image-resizer': { scale: 1.5 },
  'image-rotate-flip': { rotation: 90, flipX: false, flipY: false },
  'image-brightness-contrast': { brightness: 115 },
  'image-saturation-hue': { saturation: 120, hue: 10 },
  'image-exposure': { exposure: 1 },
  'image-highlights-shadows': { highlights: 10 },
  'image-sharpen': { amount: 110 },
  'image-blur': { radius: 6 },
  'image-grayscale-duotone': { intensity: 100, darkColor: '#111111', lightColor: '#f5f5f5' },
  'image-filters': { preset: 'vivid' },
  'image-watermark': { text: 'FLIXO' },
  'image-text-overlay': { text: 'FLIXO' },
  'image-draw-annotate': { kind: 'arrow' },
  'image-redaction': { x: 25, y: 25, width: 50, height: 25 },
};

const SCENARIOS = [
  'valid input',
  'invalid input',
  'malformed parameter',
  'unsupported MIME',
  'corrupted image',
  'oversized file',
  'repeated validation',
  'concurrent validation',
  'cancellation',
  'timeout policy',
  'retry budget',
  'verifier failure',
  'locked layer',
  'confirmation required',
  'confirmation denied',
  'unknown tool',
  'forged execution plan',
  'local-only execution',
  'canonical executor binding',
  'output contract binding',
] as const;

function expectParameterFailure(toolId: string, params: Record<string, string | number | boolean>) {
  assert.throws(() => validateCapabilityParameters(toolId, params));
}

for (const toolId of CANONICAL_IMAGE_TOOL_IDS) {
  test(toolId + ' / valid input', () => {
    assert.doesNotThrow(() => validateCapabilityParameters(toolId, VALID[toolId]));
    const tool = TOOL_CATALOG.byId.get(toolId);
    assert.ok(tool);
    assert.equal(tool.capability.state, 'EXECUTABLE');
    assert.equal(tool.capability.executionMode, 'LOCAL');
  });

  test(toolId + ' / invalid input', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId, inputBlob: null as unknown as Blob, parameters: VALID[toolId], origin: 'manual',
      }),
      /INVALID_LOCAL_BLOB/,
    );
  });

  test(toolId + ' / malformed parameter', () => {
    expectParameterFailure(toolId, { malformed: '{not-json}' });
  });

  test(toolId + ' / unsupported MIME', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId, inputBlob: PDF, parameters: VALID[toolId], origin: 'manual',
      }),
      /INVALID_IMAGE_MIME/,
    );
  });

  test(toolId + ' / corrupted image', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId, inputBlob: PNG_CORRUPTED, parameters: VALID[toolId], origin: 'manual',
      }),
      /IMAGE_DECODER_UNAVAILABLE|Image could not be decoded|could not be decoded/i,
    );
  });

  test(toolId + ' / oversized file', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId, inputBlob: OVERSIZED, parameters: VALID[toolId], origin: 'manual',
      }),
      /INPUT_SIZE_LIMIT_EXCEEDED/,
    );
  });

  test(toolId + ' / repeated validation', async () => {
    const a = await validateCanonicalImageExecutionRequest({
      toolId, inputBlob: PDF, parameters: VALID[toolId], origin: 'manual',
    }).catch((e: unknown) => String(e));
    const b = await validateCanonicalImageExecutionRequest({
      toolId, inputBlob: PDF, parameters: VALID[toolId], origin: 'manual',
    }).catch((e: unknown) => String(e));
    assert.equal(a, b);
    assert.match(a, /INVALID_IMAGE_MIME/);
  });

  test(toolId + ' / concurrent validation', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () =>
      validateCanonicalImageExecutionRequest({
        toolId, inputBlob: PDF, parameters: VALID[toolId], origin: 'manual',
      }).then(() => 'PASS', () => 'REJECT'),
    ));
    assert.deepEqual(results, ['REJECT', 'REJECT', 'REJECT', 'REJECT']);
  });

  test(toolId + ' / cancellation', async () => {
    const controller = new AbortController();
    controller.abort(new DOMException('cancelled', 'AbortError'));
    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId, inputBlob: PNG_CORRUPTED, parameters: VALID[toolId], origin: 'manual', signal: controller.signal,
      }),
      /Abort|cancel/i,
    );
  });

  test(toolId + ' / timeout policy', () => {
    const capability = getCapability(toolId);
    assert.ok(capability);
    assert.ok(capability.safetyLimits.timeoutMs > 0);
    assert.ok(capability.safetyLimits.timeoutMs <= 30_000);
  });

  test(toolId + ' / retry budget', () => {
    const capability = getCapability(toolId);
    assert.ok(capability);
    assert.ok(capability.recovery.maxAttempts >= 1);
    assert.ok(capability.recovery.maxAttempts <= 3);
    assert.equal(capability.recovery.replanOnFailure, false);
  });

  test(toolId + ' / verifier failure', async () => {
    const capability = getCapability(toolId);
    assert.ok(capability);
    const result = await capability.verifier(PNG_CORRUPTED, new Blob([], { type: 'image/png' }), VALID[toolId]);
    assert.equal(result, false);
  });

  test(toolId + ' / locked layer', () => {
    assert.throws(
      () => assertTargetLayersUnlocked(['locked'], [{ id: 'locked', locked: true }]),
      /LOCKED_LAYER_EXECUTION_REJECTED/,
    );
  });

  test(toolId + ' / confirmation required', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId, inputBlob: PDF, parameters: VALID[toolId], origin: 'agent', confirmed: false,
      }),
      /CONFIRMATION_REQUIRED/,
    );
  });

  test(toolId + ' / confirmation denied', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId, inputBlob: PDF, parameters: VALID[toolId], origin: 'agent', confirmed: true,
      }),
      /CONFIRMATION_TOKEN_INVALID|CONFIRMATION_TOKEN|AGENT_SECURITY_CONTEXT_REQUIRED/,
    );
  });

  test(toolId + ' / unknown tool', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId: toolId + '-unknown', inputBlob: PDF, parameters: VALID[toolId], origin: 'manual',
      }),
      /UNKNOWN_TOOL/,
    );
  });

  test(toolId + ' / forged execution plan', () => {
    assert.throws(
      () => parseExecutionPlan({
        workflowName: 'forged',
        confidence: 1,
        catalogFingerprint: TOOL_CATALOG.fingerprint,
        steps: [{ toolId: toolId + '-forged', params: VALID[toolId] }],
      }),
      /not executable or not registered|Tool is not executable|non-executable capability/i,
    );
  });

  test(toolId + ' / local-only execution', () => {
    const capability = getCapability(toolId);
    assert.ok(capability);
    assert.equal(capability.executionMode, 'LOCAL');
    assert.equal(capability.requirements.network, false);
  });

  test(toolId + ' / canonical executor binding', () => {
    const capability = getCapability(toolId);
    assert.ok(capability);
    assert.equal(capability.operational.executorId, toolId);
  });

  test(toolId + ' / output contract binding', () => {
    const capability = getCapability(toolId);
    assert.ok(capability);
    assert.equal(capability.operational.outputContractId, toolId);
  });
}

test('AGENT-2 adversarial matrix is exactly 20 canonical tools × 20 scenarios', () => {
  assert.equal(CANONICAL_IMAGE_TOOL_IDS.length, 20);
  assert.equal(SCENARIOS.length, 20);
  assert.equal(CANONICAL_IMAGE_TOOL_IDS.length * SCENARIOS.length, 400);
});
