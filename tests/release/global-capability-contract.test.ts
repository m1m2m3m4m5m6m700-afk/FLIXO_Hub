import assert from 'node:assert/strict';
import test from 'node:test';
import { assertGlobalCapabilityManifest, GlobalCapabilityManifestSchema } from '../../src/config/tool-platform/global-capability-contract.ts';

const base = {
  id: 'example-tool',
  family: 'image',
  lifecycle: 'ready',
  executionMode: 'browser-local',
  input: { mediaTypes: ['image/png'], maxBytes: 10_000_000 },
  output: { contractId: 'image-output-v1', mediaTypes: ['image/png'] },
  safety: { classification: 'low', maxDurationMs: 30_000, sandboxRequired: true },
  privacy: { dataClass: 'personal', fileBytesUploaded: false, thirdPartyProcessing: false },
  localization: { titleKey: 'tools.example.title', descriptionKey: 'tools.example.description' },
  regionalAvailability: { mode: 'global', regions: ['eu', 'us', 'me', 'apac'] },
  evidence: { requiredChecks: ['core-ci'], acceptanceCorpus: 'example-corpus-v1', exactShaRequired: true },
  sourceSha: null,
};

test('accepts a browser-local global capability manifest', () => {
  assert.equal(assertGlobalCapabilityManifest(base).id, 'example-tool');
});

test('rejects implicit remote processing and unbounded personal-data upload', () => {
  const remote = structuredClone(base);
  remote.executionMode = 'remote';
  remote.privacy.thirdPartyProcessing = false;
  assert.throws(() => GlobalCapabilityManifestSchema.parse(remote));

  const upload = structuredClone(base);
  upload.privacy.fileBytesUploaded = true;
  assert.throws(() => GlobalCapabilityManifestSchema.parse(upload));
});
