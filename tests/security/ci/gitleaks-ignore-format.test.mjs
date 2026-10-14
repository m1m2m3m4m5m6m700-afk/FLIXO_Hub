import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Gitleaks ignore entries are unique, commit-specific finding fingerprints', () => {
  const source = readFileSync(new URL('../../../.gitleaksignore', import.meta.url), 'utf8');
  const fingerprints = source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  assert.equal(fingerprints.length, 21, 'all reconciled SARIF findings must have one narrow fingerprint');
  assert.equal(new Set(fingerprints).size, fingerprints.length, 'duplicate suppressions are not allowed');

  for (const fingerprint of fingerprints) {
    const parts = fingerprint.split(':');
    assert.ok(parts.length >= 4, 'fingerprint must include commit, path, rule ID, and line');
    const commit = parts.shift();
    const line = parts.pop();
    const ruleId = parts.pop();
    const path = parts.join(':');

    assert.match(commit, /^[a-f0-9]{40}$/u, 'historical fingerprint must name the exact commit');
    assert.ok(path.length > 0, 'fingerprint path must not be empty');
    assert.match(ruleId, /^[a-z0-9-]+$/u, 'fingerprint must use a concrete Gitleaks rule ID');
    assert.match(line, /^[1-9]\d*$/u, 'fingerprint must use a valid start line');
  }

  assert.ok(
    fingerprints.some((entry) => entry.includes(':المهام.md:cloudflare-api-key:27')),
    'the ledger finding must target the canonical Arabic ledger path',
  );
});
