import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

const GUARDS = [
  'scripts/media/verify-public-executable-surface.mjs',
  'scripts/tool-chain/verify-tool-chain-parity.mjs',
  'scripts/media/verify-ocr-runtime-pin.mjs',
] as const;

test('agent-4 repository guards execute successfully', () => {
  for (const script of GUARDS) {
    const output = execFileSync(process.execPath, [script], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(output, script).toContain('"status":"PASS"');
  }
});
