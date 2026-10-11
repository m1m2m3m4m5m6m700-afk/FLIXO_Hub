// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const EXPECTED_LICENSE_SHA256 =
  'd8a6cc31abc16b6748c7a21f21611f5a1ec33f67d22ca23d7da1c19b95496bee';

test('LICENSE is the expected official AGPL-3.0-only text', () => {
  const license = readFileSync('LICENSE');
  const sha256 = crypto.createHash('sha256').update(license).digest('hex');
  assert.equal(
    sha256,
    EXPECTED_LICENSE_SHA256,
    `LICENSE SHA-256 mismatch: expected ${EXPECTED_LICENSE_SHA256}, got ${sha256}`,
  );
});

test('REUSE license text is byte-identical to LICENSE', () => {
  assert.deepEqual(
    readFileSync('LICENSES/AGPL-3.0-only.txt'),
    readFileSync('LICENSE'),
  );
});
