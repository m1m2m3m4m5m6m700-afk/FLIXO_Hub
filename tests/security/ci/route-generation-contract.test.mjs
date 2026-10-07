import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('public route generators admit only executable capabilities', () => {
  const sitemap = readFileSync('scripts/generate-sitemap.mjs', 'utf8');
  const staticRoutes = readFileSync('scripts/generate-static-route-entries.mjs', 'utf8');

  assert.match(sitemap, /tool\.isReady && tool\.capability\.state === 'EXECUTABLE'/u);
  assert.doesNotMatch(sitemap, /const readyTools =/u);
  assert.match(staticRoutes, /tool\.isReady && tool\.capability\.state === 'EXECUTABLE'/u);
  assert.doesNotMatch(staticRoutes, /const readyTools =/u);
});
