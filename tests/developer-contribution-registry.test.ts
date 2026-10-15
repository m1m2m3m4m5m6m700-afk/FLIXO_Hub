import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTRIBUTION_REGISTRY,
  CONTRIBUTION_REGISTRY_VERSION,
  contributionKinds,
  getPublishedContributions,
  validateContributionRecord,
} from '../src/lib/developer-platform/contribution-registry.ts';

test('contribution registry has unique valid records', () => {
  assert.match(CONTRIBUTION_REGISTRY_VERSION, /^\d+\.\d+\.\d+$/);
  const ids = new Set(CONTRIBUTION_REGISTRY.map((record) => record.id));
  assert.equal(ids.size, CONTRIBUTION_REGISTRY.length);
  assert.equal(CONTRIBUTION_REGISTRY.every(validateContributionRecord), true);
});

test('contribution registry exposes supported kinds and honest publication state', () => {
  assert.equal(contributionKinds().length, 9);
  assert.equal(getPublishedContributions().length, 0);
  assert.equal(CONTRIBUTION_REGISTRY.filter((record) => record.status === 'CORE_REFERENCE').length, 2);
});

test('contribution source and docs paths stay traversal-free', () => {
  for (const record of CONTRIBUTION_REGISTRY) {
    assert.equal(record.sourcePaths.every((path) => !path.includes('..')), true);
    assert.equal(record.docsPaths.every((path) => !path.includes('..')), true);
  }
});
