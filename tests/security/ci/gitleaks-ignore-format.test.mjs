import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const baselineFingerprints = [
  'a3ae8f4ff039cf5d3e9bb702a34d03042b28411b:docs/CELL-HARD-CONTROL-CONTRACT.md:generic-api-key:112',
  'd034d5a06bdedf2c924bfd86a700d00461b46ca0:.env.example:generic-api-key:70',
  '112bc0d8d4d104a4ade23aef8daf69a09379a9cc:المهام.md:cloudflare-api-key:27',
];
const telemetryFingerprints = [
  '22803fbfb34b2c289691661584fcd49c67cb7b27:.agent-intelligence/snapshots/snap-20261011T082417623298Z-6c333177c5a8c3ed.raw:generic-api-key:291',
  '7fe2ddda73d86d2a2f520c8eb8492be505ef7bea:.agent-intelligence/snapshots/snap-20261011T072102257271Z-c7d769e7591b4def.raw:generic-api-key:291',
  'a69ae8296541d64d31e32af472fdbd68cf745092:.agent-intelligence/snapshots/snap-20261008T081451283223Z-9266a477fa16baf3.raw:generic-api-key:291',
  '1f3cf3639a7ea33ec9fa0b51a4f2b070f3e3a6fb:.agent-intelligence/snapshots/snap-20261008T080825664757Z-a315600dfe8285bf.raw:generic-api-key:291',
  'e184f1fd3c0a627748181b5d3f5b4450dffd6fe6:.agent-intelligence/snapshots/snap-20261007T211847075160Z-b4428f2b76ee1153.raw:generic-api-key:291',
  '24b9e2197b68f62076cd8d16be83b9cfe9fb1ff2:.agent-intelligence/snapshots/snap-20261007T054659727323Z-5cd4a3fcacf87b17.raw:generic-api-key:291',
  '397d114aa3d2003cc86fc5c9797c65d873e6ca60:.agent-intelligence/snapshots/snap-20261007T054437361425Z-cebbdf8315977995.raw:generic-api-key:291',
  'ef02b027b68338c10504ce529e918366eb5e1b6f:.agent-intelligence/snapshots/snap-20261007T054337769456Z-80e37c9c24a66d9f.raw:generic-api-key:291',
];
const publicOwaspAssetFingerprints = [
  '22803fbfb34b2c289691661584fcd49c67cb7b27:.agent-intelligence/snapshots/snap-20261011T082418575122Z-26ed84629c54cd2b.raw:jwt:46',
  '7fe2ddda73d86d2a2f520c8eb8492be505ef7bea:.agent-intelligence/snapshots/snap-20261011T072103080190Z-f2651c8711530f9b.raw:jwt:46',
  'a69ae8296541d64d31e32af472fdbd68cf745092:.agent-intelligence/snapshots/snap-20261008T081451844708Z-1c2a43ab506560f0.raw:jwt:46',
  '1f3cf3639a7ea33ec9fa0b51a4f2b070f3e3a6fb:.agent-intelligence/snapshots/snap-20261008T080826962747Z-1c2a43ab506560f0.raw:jwt:46',
  'e184f1fd3c0a627748181b5d3f5b4450dffd6fe6:.agent-intelligence/snapshots/snap-20261007T211848104231Z-f4a3e6fed48fa5bd.raw:jwt:46',
  '24b9e2197b68f62076cd8d16be83b9cfe9fb1ff2:.agent-intelligence/snapshots/snap-20261007T054700585464Z-82830ecb6dcd500e.raw:jwt:46',
  '397d114aa3d2003cc86fc5c9797c65d873e6ca60:.agent-intelligence/snapshots/snap-20261007T054437818957Z-82830ecb6dcd500e.raw:jwt:46',
  'ef02b027b68338c10504ce529e918366eb5e1b6f:.agent-intelligence/snapshots/snap-20261007T054338433788Z-e6913b6950195f34.raw:jwt:46',
];
const isolatedTestFixtureFingerprints = [
  'a4d85af76b8dc19116ebb1043fb1cafeb36fbe54:scripts/ci/test-chair1-central-lease-adversarial.mjs:generic-api-key:18',
  '9ed9a5f1a518defb915f1391a0c03f7e6d925a44:scripts/ci/test-auto-repair-chair1-audit.mjs:generic-api-key:93',
];

test('Gitleaks ignore entries match the exact reviewed false-positive allowlist', () => {
  const source = readFileSync('.gitleaksignore', 'utf8');
  const entries = source.split(/\r?\n/u).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  const approved = [
    ...baselineFingerprints,
    ...telemetryFingerprints,
    ...publicOwaspAssetFingerprints,
    ...isolatedTestFixtureFingerprints,
  ];
  assert.equal(entries.length, 21, 'only 21 exact reviewed fingerprints are permitted');
  assert.deepEqual([...entries].sort(), [...approved].sort(), 'unreviewed findings, paths, globs, and wildcards must remain unsuppressed');
  for (const entry of entries) {
    assert.match(entry, /^[0-9a-f]{40}:.+:[a-z0-9-]+:\d+$/u, 'malformed exact fingerprint');
    assert.doesNotMatch(entry, /\?{2,}|\*/u, 'do not use corrupted paths, globs, or wildcards');
  }
  assert.ok(entries.includes('112bc0d8d4d104a4ade23aef8daf69a09379a9cc:المهام.md:cloudflare-api-key:27'), 'Arabic canonical ledger path must remain intact in UTF-8');
  const snapshots = entries.filter(entry => entry.includes('.agent-intelligence/snapshots/'));
  assert.equal(snapshots.length, 16, 'only 16 individually-reviewed snapshot fingerprints are allowed');
  assert.deepEqual(
    snapshots.filter(entry => entry.endsWith(':jwt:46')).sort(),
    [...publicOwaspAssetFingerprints].sort(),
    'only the eight exact public OWASP image-metadata signed-URL snapshots are allowed; all other JWT findings stay blocking',
  );
  assert.equal(entries.filter(entry => entry.includes('scripts/ci/test-')).length, 2, 'only two confirmed isolated test fixture lines are allowed');
  assert.deepEqual(
    entries.filter(entry => entry.includes('scripts/ci/test-')).sort(),
    [...isolatedTestFixtureFingerprints].sort(),
    'do not suppress signing keys outside these two historical test lines',
  );
});
