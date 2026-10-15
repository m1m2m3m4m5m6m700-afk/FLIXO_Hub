import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLicenseInventory } from '../../scripts/audit-package-lock-licenses.mjs';

test('license inventory separates metadata presence from legal clearance', () => {
  const report = buildLicenseInventory({
    lockfileVersion: 3,
    packages: {
      '': { name: 'app', version: '1.0.0', license: 'Apache-2.0' },
      'node_modules/known-license': { name: 'known-license', version: '2.0.0', license: 'MIT', dev: true },
      'node_modules/missing-license': { name: 'missing-license', version: '1.0.0' },
      'node_modules/license-pointer': { name: 'license-pointer', version: '3.0.0', license: 'SEE LICENSE IN LICENSE.txt' },
      'node_modules/local-workspace': { name: 'local-workspace', version: '1.0.0', link: true },
    },
  });

  assert.equal(report.packageCount, 3);
  assert.equal(report.unresolvedCount, 2);
  assert.equal(report.packages.find((item) => item.name === 'known-license')?.status, 'METADATA_PRESENT_NOT_LEGAL_CLEARANCE');
  assert.equal(report.packages.find((item) => item.name === 'known-license')?.developmentOnly, true);
  assert.deepEqual(report.unresolved.map((item) => item.name), ['license-pointer', 'missing-license']);
});

test('license inventory rejects unsupported lockfile shapes', () => {
  assert.throws(() => buildLicenseInventory({ lockfileVersion: 2, packages: {} }), /package-lock\.json v3/);
});
