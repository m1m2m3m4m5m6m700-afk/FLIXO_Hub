import assert from 'node:assert/strict';
import test from 'node:test';
import { validateBaselineManifest } from '../../../scripts/ci/verify-global-baseline.mjs';

const valid = {
  repository: 'm1m2m3m4m5m6m700-afk/FLIXO_Hub',
  executionSha: '61625ef1808af1761e0aeecb9731a5ae080816ae',
  measuredAtUtc: '2026-10-06T23:07:00Z',
  methodologyVersion: 'global-baseline-v1',
  regions: ['europe', 'north-america', 'middle-east', 'asia-pacific'].map((id) => ({
    id, probeCount: 10, p50Ms: 100, p95Ms: 250, errorRate: 0,
    fileBytesUploaded: false, thirdPartyUploadRoutes: 0,
  })),
  privacyEvidence: { fileBytesUploaded: false, thirdPartyUploadRoutes: 0, consentBehaviorVerified: true },
  accessibilityEvidence: { wcagVersion: '2.2', targetLevel: 'AA', automatedChecksPass: true, manualReviewRecorded: true },
  localizationEvidence: { canonicalLocaleCount: 20, rtlLocalePresent: true, hreflangVerified: true, localizedMetadataVerified: true },
};

test('accepts an exact-SHA global baseline manifest', () => {
  assert.deepEqual(validateBaselineManifest(valid), { ok: true, errors: [] });
});

test('rejects a missing region and any upload claim', () => {
  const result = validateBaselineManifest({
    ...valid,
    regions: valid.regions.filter((region) => region.id !== 'middle-east'),
    privacyEvidence: { ...valid.privacyEvidence, fileBytesUploaded: true },
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('region:missing:middle-east'));
  assert.ok(result.errors.includes('privacy:fileBytesUploaded:not-false'));
});
