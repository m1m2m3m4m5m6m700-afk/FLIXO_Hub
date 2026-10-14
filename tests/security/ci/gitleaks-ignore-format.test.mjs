import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const approvedFingerprints = [
  'a3ae8f4ff039cf5d3e9bb702a34d03042b28411b:docs/CELL-HARD-CONTROL-CONTRACT.md:generic-api-key:112',
  'd034d5a06bdedf2c924bfd86a700d00461b46ca0:.env.example:generic-api-key:70',
  '112bc0d8d4d104a4ade23aef8daf69a09379a9cc:المهام.md:cloudflare-api-key:27',
  '22803fbfb34b2c289691661584fcd49c67cb7b27:.agent-intelligence/snapshots/snap-20261011T082417623298Z-6c333177c5a8c3ed.raw:generic-api-key:291',
  '7fe2ddda73d86d2a2f520c8eb8492be505ef7bea:.agent-intelligence/snapshots/snap-20261011T072102257271Z-c7d769e7591b4def.raw:generic-api-key:291',
  'a69ae8296541d64d31e32af472fdbd68cf745092:.agent-intelligence/snapshots/snap-20261008T081451283223Z-9266a477fa16baf3.raw:generic-api-key:291',
  '1f3cf3639a7ea33ec9fa0b51a4f2b070f3e3a6fb:.agent-intelligence/snapshots/snap-20261008T080825664757Z-a315600dfe8285bf.raw:generic-api-key:291',
  'e184f1fd3c0a627748181b5d3f5b4450dffd6fe6:.agent-intelligence/snapshots/snap-20261007T211847075160Z-b4428f2b76ee1153.raw:generic-api-key:291',
  '24b9e2197b68f62076cd8d16be83b9cfe9fb1ff2:.agent-intelligence/snapshots/snap-20261007T054659727323Z-5cd4a3fcacf87b17.raw:generic-api-key:291',
  '397d114aa3d2003cc86fc5c9797c65d873e6ca60:.agent-intelligence/snapshots/snap-20261007T054437361425Z-cebbdf8315977995.raw:generic-api-key:291',
  'ef02b027b68338c10504ce529e918366eb5e1b6f:.agent-intelligence/snapshots/snap-20261007T054337769456Z-80e37c9c24a66d9f.raw:generic-api-key:291',
];

test('Gitleaks ignore entries match the exact reviewed false-positive allowlist', () => {
  const source = readFileSync('.gitleaksignore', 'utf8');
  const entries = source.split(/\r?\n/u).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  assert.deepEqual([...entries].sort(), [...approvedFingerprints].sort(), 'unreviewed findings, paths, globs, and wildcards must remain unsuppressed');
  for (const entry of entries) {
    assert.match(entry, /^[0-9a-f]{40}:.+:[a-z0-9-]+:\d+$/u, 'malformed exact fingerprint');
    assert.doesNotMatch(entry, /\?{2,}|\*/u, 'do not use corrupted paths, globs, or wildcards');
  }
  assert.ok(entries.includes('112bc0d8d4d104a4ade23aef8daf69a09379a9cc:المهام.md:cloudflare-api-key:27'), 'Arabic canonical ledger path must remain intact in UTF-8');
  assert.equal(entries.filter(entry => entry.includes('.agent-intelligence/snapshots/')).length, 8, 'only eight verified public telemetry fingerprints may be suppressed');
  assert.equal(entries.some(entry => entry.endsWith(':jwt:46')), false, 'potentially active signed URLs must stay blocking');
  assert.equal(entries.some(entry => entry.includes('scripts/ci/test-')), false, 'unverified historical test signing values must stay blocking');
});
