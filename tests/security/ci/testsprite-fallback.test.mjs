import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { runNativeTestSpriteFallback } from '../../../scripts/ci/testsprite-fallback.mjs';

test('native TestSprite fallback rejects invalid candidate identity', () => {
  assert.throws(
    () => runNativeTestSpriteFallback({ sha: 'not-a-sha', runner: () => {} }),
    /TESTSPRITE_FALLBACK_INVALID_SHA/u,
  );
});

test('native TestSprite fallback runs the exact MVP E2E and writes bounded evidence', () => {
  const calls = [];
  const outputDir = '.testsprite-fallback-test';
  try {
    const result = runNativeTestSpriteFallback({
      sha: 'a'.repeat(40),
      installChromium: false,
      outputDir,
      runner: (command, args) => calls.push([command, args]),
    });
    assert.deepEqual(calls, [[
      'npm',
      ['run', 'test:e2e', '--', '--project=chromium', 'tests/official/mvp-10-release-verification.spec.ts'],
    ]]);
    assert.equal(result.status, 'PASS');
    assert.equal(existsSync(result.summaryPath), true);
    assert.equal(JSON.parse(readFileSync(result.summaryPath, 'utf8')).sha, 'a'.repeat(40));
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});