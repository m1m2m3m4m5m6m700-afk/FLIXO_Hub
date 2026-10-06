#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

export function runNativeTestSpriteFallback({
  sha,
  runner = (command, args) => execFileSync(command, args, { stdio: 'inherit' }),
  installChromium = true,
  outputDir = 'testsprite-fallback',
} = {}) {
  if (!sha || !/^[0-9a-f]{40}$/u.test(sha)) {
    throw new Error('TESTSPRITE_FALLBACK_INVALID_SHA');
  }

  const chromiumArgs = installChromium
    ? ['playwright', 'install', '--with-deps', 'chromium']
    : [];

  if (chromiumArgs.length) runner('npx', chromiumArgs);

  runner('npm', [
    'run',
    'test:e2e',
    '--',
    '--project=chromium',
    'tests/official/mvp-10-release-verification.spec.ts',
  ]);

  mkdirSync(outputDir, { recursive: true });
  const summaryPath = outputDir + '/summary.json';
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        testsprite: 'not-configured',
        fallback: 'native-playwright',
        sha,
        status: 'PASS',
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  return { summaryPath, sha, status: 'PASS' };
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll('\\', '/'))) {
  runNativeTestSpriteFallback({ sha: process.env.EXPECTED_SHA });
}
