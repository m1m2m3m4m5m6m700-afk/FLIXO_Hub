import assert from 'node:assert/strict';
import test from 'node:test';
import { getToolDefinition } from '../src/config/registry.ts';

const ADVERSARIAL_SCENARIO_COUNT = 20;

const TARGET_MATRIX = [
  ['background remover', ['background-remover']],
  ['upscaler', ['image-upscaler']],
  ['cropper', ['image-cropper']],
  ['compressor', ['image-compressor']],
  ['converter', ['image-converter']],
  ['effects', ['image-effects']],
  ['resize', ['image-resizer']],
  ['rotate/flip', ['image-rotate', 'image-flip-horizontal', 'image-flip-vertical']],
  ['brightness/contrast', ['image-brightness', 'image-contrast']],
  ['saturation/hue', ['image-saturation', 'image-hue']],
  ['exposure', ['image-exposure']],
  ['highlights/shadows', ['image-highlights', 'image-shadows']],
  ['sharpen', ['image-sharpen']],
  ['blur', ['image-blur']],
  ['grayscale/duotone', ['image-grayscale', 'image-duotone']],
  ['filters', ['filter-mask']],
  ['watermark', ['watermark-adder']],
  ['text overlay', ['text-overlay']],
  ['draw/annotate', ['draw-annotate']],
  ['redaction', ['redaction']],
] as const;

for (const [category, toolIds] of TARGET_MATRIX) {
  test(`red-team 20-tool gate: ${category}`, () => {
    const states = toolIds.map((id) => [id, getToolDefinition(id)?.capability.state ?? 'MISSING'] as const);
    const failures = states.filter(([, state]) => state !== 'EXECUTABLE');
    assert.deepEqual(
      failures,
      [],
      `Target requires ${ADVERSARIAL_SCENARIO_COUNT} adversarial scenarios per tool; every mapped capability must be canonical EXECUTABLE. Observed: ${JSON.stringify(states)}`,
    );
  });
}
