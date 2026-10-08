// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'node:assert/strict';
import test from 'node:test';
import { FLIXO_REPOSITORY_URL } from '../src/components/flixo-attribution.ts';

test('FLIXO attribution footer points to the canonical repository', () => {
  assert.equal(
    FLIXO_REPOSITORY_URL,
    'https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub',
  );
});
