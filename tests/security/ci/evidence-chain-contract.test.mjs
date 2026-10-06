import assert from 'node:assert/strict';
import test from 'node:test';
import { validateEvidenceChain } from '../../../scripts/ci/verify-evidence-chain.mjs';

const valid = {
  sourceSha: '61625ef1808af1761e0aeecb9731a5ae080816ae',
  testedSha: '61625ef1808af1761e0aeecb9731a5ae080816ae',
  builtSha: '61625ef1808af1761e0aeecb9731a5ae080816ae',
  artifactDigest: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  attestationRef: 'attestation://example',
  deploymentId: 'deploy-001',
  deploymentSha: '61625ef1808af1761e0aeecb9731a5ae080816ae',
  environment: 'production',
  productionVerified: true,
};

test('accepts a complete source-to-production evidence chain', () => {
  assert.deepEqual(validateEvidenceChain(valid), { ok: true, errors: [] });
});

test('rejects a deployment or tested SHA that drifts from the source SHA', () => {
  const result = validateEvidenceChain({ ...valid, deploymentSha: '0000000000000000000000000000000000000000' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('deploymentSha:not-source'));
});
