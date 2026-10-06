import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MVP_NEGATIVE_INTENT_SUITE,
  MVP_NEGATIVE_INTENT_SUITE_VERSION,
  MVP_STANDARD_INTENT_SUITE,
  MVP_STANDARD_INTENT_SUITE_VERSION,
} from '../src/lib/contracts/mvp-scope.ts';
import { planAgentRequest } from '../src/lib/agent-guided-runtime.ts';

const image = () => new File(['corpus-image'], 'fixture.png', { type: 'image/png' });
const video = () => new File(['corpus-video'], 'fixture.webm', { type: 'video/webm' });

test('versioned MVP acceptance corpus resolves every positive case through canonical planning', () => {
  assert.equal(MVP_STANDARD_INTENT_SUITE_VERSION, 2);
  for (const item of MVP_STANDARD_INTENT_SUITE) {
    const file = item.id.includes('video') ? video() : image();
    try {
      const plan = planAgentRequest(item.request, file);
      assert.deepEqual(plan.steps.map((step) => step.toolId), item.expectedToolIds, item.id);
      assert.equal(plan.catalogFingerprint.length > 0, true, item.id);
    } catch (error) {
      throw new Error(
        `corpus case ${item.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }
});

test('versioned MVP negative corpus never guesses ambiguous or unsupported requests', () => {
  assert.equal(MVP_NEGATIVE_INTENT_SUITE_VERSION, 1);
  for (const item of MVP_NEGATIVE_INTENT_SUITE) {
    assert.throws(
      () => planAgentRequest(item.request, image()),
      /No admitted FLIXO MVP capability|Request is ambiguous/i,
      item.id,
    );
  }
});
