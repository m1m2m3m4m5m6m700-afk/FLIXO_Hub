import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { FLIXO_MVP_SCOPE } from '../../src/lib/contracts/mvp-scope.ts';

const SOURCE_ROOTS = ['src/tools', 'src/config', 'src/lib'];
const FORBIDDEN_AGENT_PATTERNS = [
  /@\/lib\/agent\//u,
  /from\s+['"][^'"]*\/lib\/agent\//u,
  /executeAgentToolLocally/u,
  /FLIXO_AGENT/u,
];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const info = statSync(path);
    if (info.isDirectory()) walk(path, files);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/u.test(path)) files.push(path);
  }
  return files;
}

test('MVP contract is explicitly Manual-Only', () => {
  assert.equal(FLIXO_MVP_SCOPE.productMode, 'MANUAL_ONLY');
  assert.equal(FLIXO_MVP_SCOPE.workflow.agentGuided, false);
  assert.equal(FLIXO_MVP_SCOPE.workflow.manualStandalone, true);
  assert.equal(FLIXO_MVP_SCOPE.processing.executionLocation, 'BROWSER_ONLY');
  assert.equal(FLIXO_MVP_SCOPE.processing.userFileBytesMayCrossNetwork, false);
});

test('production source contains no Agent runtime import or execution hook', () => {
  const violations: string[] = [];
  for (const root of SOURCE_ROOTS) {
    for (const path of walk(root)) {
      const source = readFileSync(path, 'utf8');
      if (FORBIDDEN_AGENT_PATTERNS.some((pattern) => pattern.test(source))) {
        violations.push(path);
      }
    }
  }
  assert.deepEqual(violations, []);
});
