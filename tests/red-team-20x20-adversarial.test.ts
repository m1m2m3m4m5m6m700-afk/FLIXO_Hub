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
const PDF = new Blob(['%PDF-but-not-a-real-pdf'], { type: 'application/pdf' });
const EMPTY_IMAGE = new Blob([], { type: 'image/png' });
const OVERSIZED = new Blob([new Uint8Array(64 * 1024 * 1024 + 1)], { type: 'image/png' });
const VALID: Record<string, Record<string, string | number | boolean>> = {
  'background-remover': { tolerance: 32 },
  'image-upscaler': { scale: 2 },
  'image-cropper': { x: 0, y: 0, cropWidth: 80, cropHeight: 80, width: 80, height: 80 },
  'image-compressor': { quality: 0.8, format: 'image/webp' },
  'image-converter': { format: 'image/webp' },
  'image-effects': { brightness: 115, contrast: 105 },
  'image-resizer': { scale: 2 },
  'image-rotate-flip': { rotation: 90, flipX: false, flipY: false },
  'image-brightness-contrast': { brightness: 115, contrast: 100 },
  'image-saturation-hue': { saturation: 120, hue: 10 },
  'image-exposure': { exposure: 1 },
  'image-highlights-shadows': { highlights: 10, shadows: 10 },
  'image-sharpen': { amount: 110 },
  'image-blur': { radius: 6 },
  'image-grayscale-duotone': { intensity: 100, darkColor: '#111111', lightColor: '#f5f5f5' },
  'image-filters': { preset: 'vivid' },
  'image-watermark': { text: 'FLIXO', x: 10, y: 90, fontSize: 32, opacity: 0.65, color: '#ffffff' },
  'image-text-overlay': { text: 'FLIXO', x: 50, y: 50, fontSize: 48, color: '#ffffff', backgroundOpacity: 0.5, align: 'center' },
  'image-draw-annotate': { kind: 'arrow', x1: 10, y1: 10, x2: 80, y2: 80, stroke: '#ff3b30', strokeWidth: 8 },
  'image-redaction': { x: 25, y: 25, width: 50, height: 25, color: '#000000' },
};

const ZERO_OR_NEGATIVE: Record<string, Record<string, string | number | boolean>> = {
  'background-remover': { tolerance: -1 },
  'image-upscaler': { scale: 0 },
  'image-cropper': { width: 0 },
  'image-compressor': { quality: 0 },
  'image-converter': { format: 'image/bmp' },
  'image-effects': { brightness: -1 },
  'image-resizer': { scale: 0 },
  'image-rotate-flip': { rotation: 45 },
  'image-brightness-contrast': { brightness: 0, contrast: 100 },
  'image-saturation-hue': { saturation: 0, hue: 0 },
  'image-exposure': { exposure: 0 },
  'image-highlights-shadows': { highlights: 0, shadows: 0 },
  'image-sharpen': { amount: 0 },
  'image-blur': { radius: 0 },
  'image-grayscale-duotone': { intensity: 0 },
  'image-filters': { preset: 'unknown' },
  'image-watermark': { text: '' },
  'image-text-overlay': { text: '' },
  'image-draw-annotate': { strokeWidth: 0 },
  'image-redaction': { width: 0 },
};

const ENORMOUS: Record<string, Record<string, string | number | boolean>> = {
  'background-remover': { tolerance: 999 },
  'image-upscaler': { scale: 9 },
  'image-cropper': { width: 4_000_001, height: 4_000_001 },
  'image-compressor': { maxWidth: 4_000_001 },
  'image-converter': { format: 'image/' + 'x'.repeat(32) },
  'image-effects': { brightness: 999 },
  'image-resizer': { scale: 9 },
  'image-rotate-flip': { rotation: 999 },
  'image-brightness-contrast': { brightness: 999 },
  'image-saturation-hue': { hue: 999 },
  'image-exposure': { exposure: 9 },
  'image-highlights-shadows': { highlights: 999 },
  'image-sharpen': { amount: 999 },
  'image-blur': { radius: 999 },
  'image-grayscale-duotone': { intensity: 999 },
  'image-filters': { preset: 'x'.repeat(80) },
  'image-watermark': { fontSize: 999 },
  'image-text-overlay': { fontSize: 999 },
  'image-draw-annotate': { strokeWidth: 999 },
  'image-redaction': { width: 999 },
};

const SCENARIOS = [
  'valid input',
  'invalid input',
  'missing parameter',
  'malformed parameter',
  'unsupported MIME',
  'corrupted image',
  'zero/negative dimensions',
  'enormous dimensions',
  'oversized file',
  'repeated execution',
  'concurrent execution',
  'cancellation',
  'timeout',
  'retry exhaustion',
  'verifier failure',
  'locked layer',
  'confirmation required',
  'confirmation denied',
  'unknown tool name',
  'forged execution plan',
] as const;

assert.equal(CANONICAL_IMAGE_TOOL_IDS.length, 20);
assert.equal(SCENARIOS.length, 20);

const REQUIRED_ON_EMPTY = new Set([
  'image-resizer',
  'image-brightness-contrast',
  'image-saturation-hue',
  'image-exposure',
  'image-highlights-shadows',
  'image-converter',
  'image-filters',
  'image-watermark',
  'image-text-overlay',
]);

function expectParameterFailure(toolId: string, params: Record<string, string | number | boolean>): void {
  assert.throws(() => validateCapabilityParameters(toolId, params));
}

for (const toolId of CANONICAL_IMAGE_TOOL_IDS) {
  test(toolId + ' / valid input contract', () => {
    assert.doesNotThrow(() => validateCapabilityParameters(toolId, VALID[toolId]));
    const tool = TOOL_CATALOG.byId.get(toolId);
    assert.ok(tool);
    assert.equal(tool.capability.state, 'EXECUTABLE');
  });

  test(toolId + ' / invalid input', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId,
        inputBlob: null as unknown as Blob,
        parameters: VALID[toolId],
        origin: 'manual',
      }),
      /INVALID_LOCAL_BLOB/,
    );
  });

  test(toolId + ' / missing parameter', () => {
    const threw = (() => {
      try {
        validateCapabilityParameters(toolId, {});
        return false;
      } catch {
        return true;
      }
    })();
    assert.equal(threw, REQUIRED_ON_EMPTY.has(toolId));
  });

  test(toolId + ' / malformed parameter', () => {
    expectParameterFailure(toolId, { malformed: '{not-json}' });
  });

  test(toolId + ' / unsupported MIME', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId,
        inputBlob: PDF,
        parameters: VALID[toolId],
        origin: 'manual',
      }),
      /INVALID_IMAGE_MIME/,
    );
  });

  test(toolId + ' / corrupted image', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId,
        inputBlob: PNG_CORRUPTED,
        parameters: VALID[toolId],
        origin: 'manual',
      }),
      /Image could not be decoded|Image input must be|Image decoding is unavailable|not be decoded/i,
    );
  });

  test(toolId + ' / zero or negative dimensions', () => {
    expectParameterFailure(toolId, ZERO_OR_NEGATIVE[toolId]);
  });

  test(toolId + ' / enormous dimensions', () => {
    expectParameterFailure(toolId, ENORMOUS[toolId]);
  });

  test(toolId + ' / oversized file', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId,
        inputBlob: OVERSIZED,
        parameters: VALID[toolId],
        origin: 'manual',
      }),
      /INPUT_SIZE_LIMIT_EXCEEDED/,
    );
  });

  test(toolId + ' / repeated execution validation', async () => {
    const results = await Promise.all([
      validateCanonicalImageExecutionRequest({ toolId, inputBlob: PDF, parameters: VALID[toolId], origin: 'manual' }).then(() => 'unexpected-pass').catch((e: unknown) => String(e instanceof Error ? e.message : e)),
      validateCanonicalImageExecutionRequest({ toolId, inputBlob: PDF, parameters: VALID[toolId], origin: 'manual' }).then(() => 'unexpected-pass').catch((e: unknown) => String(e instanceof Error ? e.message : e)),
    ]);
    assert.deepEqual(results, [results[0], results[0]]);
    assert.match(results[0], /INVALID_IMAGE_MIME/);
  });

  test(toolId + ' / concurrent validation', async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        validateCanonicalImageExecutionRequest({ toolId, inputBlob: PDF, parameters: VALID[toolId], origin: 'manual' })
          .then(() => false)
          .catch(() => true),
      ),
    );
    assert.deepEqual(results, [true, true, true, true]);
  });

  test(toolId + ' / cancellation', async () => {
    const controller = new AbortController();
    controller.abort(new DOMException('cancelled', 'AbortError'));
    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId,
        inputBlob: PNG_CORRUPTED,
        parameters: VALID[toolId],
        origin: 'manual',
        signal: controller.signal,
      }),
      /Abort|cancel/i,
    );
  });

  test(toolId + ' / timeout policy', () => {
    const tool = TOOL_CATALOG.byId.get(toolId);
    assert.ok(tool);
    assert.ok(tool.safetyLimits.timeoutMs > 0);
    assert.ok(tool.safetyLimits.timeoutMs <= 30_000);
  });

  test(toolId + ' / retry exhaustion', () => {
    const capability = getCapability(toolId);
    assert.ok(capability);
    assert.ok(capability.recovery.maxAttempts > 0);
    assert.ok(capability.recovery.maxAttempts <= 3);
  });

  test(toolId + ' / verifier failure', async () => {
    const capability = getCapability(toolId);
    assert.ok(capability);
    const result = await capability.verifier(PNG_CORRUPTED, EMPTY_IMAGE, VALID[toolId]);
    assert.equal(result, false);
  });

  test(toolId + ' / locked layer', () => {
    assert.throws(
      () => assertTargetLayersUnlocked(['locked-layer'], [{ id: 'locked-layer', locked: true }]),
      /LOCKED_LAYER_EXECUTION_REJECTED/,
    );
  });

  test(toolId + ' / confirmation required', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId,
        inputBlob: PDF,
        parameters: VALID[toolId],
        origin: 'agent',
        confirmed: false,
      }),
      /CONFIRMATION_REQUIRED/,
    );
  });

  test(toolId + ' / confirmation denied', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId,
        inputBlob: PDF,
        parameters: VALID[toolId],
        origin: 'agent',
        confirmed: true,
      }),
      /AGENT_SECURITY_CONTEXT_REQUIRED/,
    );
  });

  test(toolId + ' / unknown tool name', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({
        toolId: toolId + '-unknown',
        inputBlob: PDF,
        parameters: VALID[toolId],
        origin: 'manual',
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
      /Tool is not executable|not executable or not registered|non-executable capability/i,
    );
  });
}

test('red-team matrix is exactly 20 tools x 20 scenarios', () => {
  assert.equal(CANONICAL_IMAGE_TOOL_IDS.length * SCENARIOS.length, 400);
});
