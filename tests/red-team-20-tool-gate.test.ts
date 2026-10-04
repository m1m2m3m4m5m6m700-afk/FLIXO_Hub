import assert from 'node:assert/strict';
import test from 'node:test';
import { getToolById } from '../src/config/registry.ts';
import { CANONICAL_IMAGE_TOOL_IDS } from '../src/lib/canonical-image-executor.ts';

const EXPECTED_20_TOOL_IDS = [
  'background-remover',
  'image-upscaler',
  'image-cropper',
  'image-compressor',
  'image-converter',
  'image-effects',
  'image-resizer',
  'image-rotate-flip',
  'image-brightness-contrast',
  'image-saturation-hue',
  'image-exposure',
  'image-highlights-shadows',
  'image-sharpen',
  'image-blur',
  'image-grayscale-duotone',
  'image-filters',
  'image-watermark',
  'image-text-overlay',
  'image-draw-annotate',
  'image-redaction',
] as const;

test('red-team 20-tool gate: canonical image surface is exactly 20 executable tools', () => {
  assert.deepEqual(CANONICAL_IMAGE_TOOL_IDS, EXPECTED_20_TOOL_IDS);

  for (const id of EXPECTED_20_TOOL_IDS) {
    const tool = getToolById(id);
    assert.ok(tool, `Missing canonical tool: ${id}`);
    assert.equal(tool?.capability.state, 'EXECUTABLE', `Tool is not executable: ${id}`);
    assert.equal(tool?.executionMode, 'LOCAL', `Tool is not local: ${id}`);
    assert.equal(tool?.requirements.network, false, `Tool permits network execution: ${id}`);
    assert.equal(tool?.operational.executorId, id, `Executor is not canonical: ${id}`);
    assert.equal(tool?.operational.outputContractId, id, `Output contract is not canonical: ${id}`);
    assert.equal(tool?.capability.safetyContract.requiresUserConfirmationForAgent, true, `Agent confirmation is not enforced: ${id}`);
    assert.equal(tool?.capability.safetyContract.allowLockedLayerSelection, false, `Locked-layer guard is weakened: ${id}`);
    assert.equal(tool?.capability.safetyContract.rawBlobEgress, false, `Raw Blob egress is enabled: ${id}`);
    assert.equal(tool?.capability.recovery.maxAttempts, 1, `Retry budget is not bounded: ${id}`);
    assert.equal(tool?.capability.recovery.replanOnFailure, false, `Unexpected semantic replan enabled: ${id}`);
  }
});
