import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Gitleaks ignore fingerprints are exact, UTF-8, and narrowly scoped', () => {
  const source = readFileSync('.gitleaksignore', 'utf8');
  const entries = source.split(/\r?\n/u).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  assert.equal(entries.length, 3, 'only independently confirmed false positives may be ignored');
  for (const entry of entries) {
    assert.match(entry, /^[0-9a-f]{40}:.+:[a-z0-9-]+:\d+$/u, `malformed exact fingerprint: ${entry}`);
    assert.doesNotMatch(entry, /\?{2,}|\*/u, 'do not use corrupted paths, globs, or wildcards');
  }
  assert.ok(entries.includes('112bc0d8d4d104a4ade23aef8daf69a09379a9cc:المهام.md:cloudflare-api-key:27'), 'Arabic canonical ledger path must remain intact in UTF-8');
  assert.equal(entries.some(entry => entry.includes('.agent-intelligence/snapshots/')), false, 'do not blanket-ignore discovery snapshots');
});