import assert from 'node:assert/strict';
import test from 'node:test';
import { collectQualityBarReport } from '../scripts/cli/checks/quality-bar.mjs';

test('engineering quality bar is currently green', () => {
  const report = collectQualityBarReport(process.cwd());
  assert.equal(report.status, 'PASS');
  assert.ok(Object.values(report.checks).every((value) => value === 'PASS'));
});
