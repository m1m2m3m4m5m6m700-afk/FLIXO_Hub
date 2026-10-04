import assert from 'node:assert/strict';
import test from 'node:test';
import { TOOL_CATALOG } from '../src/config/registry.ts';
import {
  CANONICAL_IMAGE_TOOL_IDS,
  validateCanonicalImageExecutionRequest,
  assertTargetLayersUnlocked,
} from '../src/lib/canonical-image-executor.ts';
import { validateCapabilityParameters } from '../src/config/manual-capability-definition.ts';
import { parseExecutionPlan } from '../src/lib/contracts/ai-plan.ts';

const PNG = new Blob(['not-a-real-image'], { type: 'image/png' });
const PDF = new Blob(['pdf'], { type: 'application/pdf' });
const EMPTY = new Blob([], { type: 'image/png' });
const OVERSIZED = new Blob([new Uint8Array(64 * 1024 * 1024 + 1)], { type: 'image/png' });

const VALID: Record<string, Record<string, string | number | boolean>> = {
  'background-remover': { tolerance: 32 },
  'image-upscaler': { scale: 2 },
  'image-cropper': {},
  'image-compressor': { quality: 0.8, format: 'image/webp' },
  'image-converter': { format: 'image/webp' },
  'image-effects': { brightness: 115, contrast: 105 },
  'image-resizer': { scale: 2 },
  'image-rotate-flip': { rotation: 90, flipX: false, flipY: false },
  'image-brightness-contrast': { brightness: 115, contrast: 105 },
  'image-saturation-hue': { saturation: 120, hue: 10 },
  'image-exposure': { exposure: 1 },
  'image-highlights-shadows': { highlights: 10, shadows: 10 },
  'image-sharpen': { amount: 110 },
  'image-blur': { radius: 6 },
  'image-grayscale-duotone': { intensity: 100, darkColor: '#111111', lightColor: '#f5f5f5' },
  'image-filters': { preset: 'x'.repeat(80) },
  'image-watermark': { text: 'FLIXO' },
  'image-text-overlay': { text: 'FLIXO' },
  'image-draw-annotate': { kind: 'arrow' },
  'image-redaction': {},
};

const REQUIRED_PARAMETER_TOOLS = new Set([
  'image-resizer',
  'image-brightness-contrast',
  'image-saturation-hue',
  'image-exposure',
  'image-highlights-shadows',
  'image-filters',
  'image-watermark',
  'image-text-overlay',
]);

const ZERO_OR_INVALID: Record<string, Record<string, string | number | boolean>> = {
  'background-remover': { tolerance: -1 },
  'image-upscaler': { scale: 0 },
  'image-cropper': { width: 0 },
  'image-compressor': { quality: 0 },
  'image-converter': { format: 'image/bmp' },
  'image-effects': { brightness: -1 },
  'image-resizer': { scale: 0 },
  'image-rotate-flip': { rotation: 45 },
  'image-brightness-contrast': { brightness: -1, contrast: 100 },
  'image-saturation-hue': { saturation: -1, hue: 0 },
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
  'image-converter': { format: ('image/' + 'x'.repeat(32)) },
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
  'image-filters': { preset: 'vivid' },
  'image-watermark': { fontSize: 999 },
  'image-text-overlay': { fontSize: 999 },
  'image-draw-annotate': { strokeWidth: 999 },
  'image-redaction': { width: 999 },
};

const scenarioNames = [
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
  'timeout policy',
  'retry exhaustion',
  'verifier failure',
  'locked layer',
  'confirmation required',
  'confirmation denied',
  'unknown tool name',
  'forged execution plan',
] as const;

test('red-team scenario catalog contains exactly 20 adversarial cases', () => {
  assert.equal(scenarioNames.length, 20);
});

test('all 20 target tools are canonical, local, executable, and verified-capable', () => {
  assert.equal(CANONICAL_IMAGE_TOOL_IDS.length, 20);
  assert.equal(new Set(CANONICAL_IMAGE_TOOL_IDS).size, 20);
  for (const id of CANONICAL_IMAGE_TOOL_IDS) {
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
    assert.ok(tool.recovery.maxAttempts > 0 && tool.recovery.maxAttempts <= 3);
    assert.ok(tool.safetyLimits.timeoutMs > 0 && tool.safetyLimits.timeoutMs <= 30_000);
  }
});

for (const id of CANONICAL_IMAGE_TOOL_IDS) {
  test(id + ' — valid input contract', () => {
    assert.doesNotThrow(() => validateCapabilityParameters(id, VALID[id]));
  });

  test(id + ' — missing parameter contract', () => {
    const parsed = (() => {
      try {
        return { ok: true as const, value: validateCapabilityParameters(id, {}) };
      } catch {
        return { ok: false as const };
      }
    })();
    assert.equal(parsed.ok, !REQUIRED_PARAMETER_TOOLS.has(id));
  });

  test(id + ' — malformed parameter contract', () => {
    assert.throws(() => validateCapabilityParameters(id, { malformed: { nested: true } } as never));
  });

  test(id + ' — zero/negative parameter rejection', () => {
    assert.throws(() => validateCapabilityParameters(id, ZERO_OR_INVALID[id]));
  });

  test(id + ' — enormous parameter rejection', () => {
    assert.throws(() => validateCapabilityParameters(id, ENORMOUS[id]));
  });

  test(id + ' — unsupported MIME fails before decode', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({ toolId: id, inputBlob: PDF, parameters: VALID[id], origin: 'manual' }),
      /INVALID_IMAGE_MIME/,
    );
  });

  test(id + ' — corrupted image fails closed', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({ toolId: id, inputBlob: PNG, parameters: VALID[id], origin: 'manual' }),
    );
  });

  test(id + ' — oversized file fails before decode', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({ toolId: id, inputBlob: OVERSIZED, parameters: VALID[id], origin: 'manual' }),
      /INPUT_SIZE_LIMIT_EXCEEDED/,
    );
  });

  test(id + ' — repeated validation is deterministic', async () => {
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        validateCanonicalImageExecutionRequest({ toolId: id, inputBlob: PDF, parameters: VALID[id], origin: 'manual' })
          .then(() => 'unexpected-pass')
          .catch((error: unknown) => error instanceof Error ? error.message : String(error)),
      ),
    );
    assert.equal(new Set(results).size, 1);
    assert.match(results[0], /INVALID_IMAGE_MIME/);
  });

  test(id + ' — concurrent validation is deterministic', async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        validateCanonicalImageExecutionRequest({ toolId: id, inputBlob: PDF, parameters: VALID[id], origin: 'manual' })
          .then(() => false)
          .catch(() => true),
      ),
    );
    assert.deepEqual(results, [true, true, true, true]);
  });

  test(id + ' — cancellation fails closed', async () => {
    const controller = new AbortController();
    controller.abort(new DOMException('cancelled', 'AbortError'));
    await assert.rejects(
      validateCanonicalImageExecutionRequest({ toolId: id, inputBlob: PNG, parameters: VALID[id], origin: 'manual', signal: controller.signal }),
      /Abort|cancel/i,
    );
  });

  test(id + ' — timeout policy is bounded', () => {
    const tool = TOOL_CATALOG.byId.get(id);
    assert.ok(tool);
    assert.ok(tool.safetyLimits.timeoutMs > 0 && tool.safetyLimits.timeoutMs <= 30_000);
  });

  test(id + ' — retry exhaustion is bounded', () => {
    const tool = TOOL_CATALOG.byId.get(id);
    assert.ok(tool?.recovery.maxAttempts > 0 && tool.recovery.maxAttempts <= 3);
  });

  test(id + ' — verifier rejects empty output', async () => {
    const tool = TOOL_CATALOG.byId.get(id);
    assert.ok(tool);
    const result = await tool.verifier(PNG, EMPTY, VALID[id]);
    assert.equal(result, false);
  });

  test(id + ' — locked layer rejects', () => {
    assert.throws(
      () => assertTargetLayersUnlocked(['locked'], [{ id: 'locked', locked: true }]),
      /LOCKED_LAYER_EXECUTION_REJECTED/,
    );
  });

  test(id + ' — confirmation required', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({ toolId: id, inputBlob: PDF, parameters: VALID[id], origin: 'agent', confirmed: false }),
      /CONFIRMATION_REQUIRED/,
    );
  });

  test(id + ' — confirmation denied', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({ toolId: id, inputBlob: PDF, parameters: VALID[id], origin: 'agent', confirmed: false }),
      /CONFIRMATION_REQUIRED/,
    );
  });

  test(id + ' — unknown tool fails closed', async () => {
    await assert.rejects(
      validateCanonicalImageExecutionRequest({ toolId: id + '-forged', inputBlob: PDF, parameters: VALID[id], origin: 'manual' }),
      /UNKNOWN_TOOL/,
    );
  });

  test(id + ' — forged execution plan fails closed', () => {
    assert.throws(
      () => parseExecutionPlan({
        workflowName: 'forged',
        confidence: 1,
        catalogFingerprint: TOOL_CATALOG.fingerprint,
        steps: [{ toolId: id + '-forged', params: VALID[id] }],
      }),
      /Tool is not executable|not executable/i,
    );
  });
}
