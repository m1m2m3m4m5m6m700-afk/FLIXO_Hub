import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SHARED_FIXTURE = resolve(ROOT, 'tests/video/shared-video-fixture.ts');
const OFFICIAL_VIDEO_SUITES = [
  'tests/official/video-capability-acceptance.spec.ts',
  'tests/official/video-media-assurance.spec.ts',
  'tests/official/mvp-10-release-verification.spec.ts',
] as const;

test('video fixture is the single canonical fixture factory for official acceptance suites', () => {
  const fixture = readFileSync(SHARED_FIXTURE, 'utf8');
  assert.match(fixture, /export async function buildVideoFixture/u);
  assert.match(fixture, /VIDEO_FIXTURE_DURATION_MS\\s*=\\s*2_400/u);
  assert.match(fixture, /VIDEO_FIXTURE_MIN_DURATION_MS\\s*=\\s*2_000/u);
  assert.match(fixture, /durationMs\\s*<\\s*VIDEO_FIXTURE_MIN_DURATION_MS/u);

  for (const suite of OFFICIAL_VIDEO_SUITES) {
    const source = readFileSync(resolve(ROOT, suite), 'utf8');
    assert.match(source, /from ['"]\.\.\/video\/shared-video-fixture['"]/u, suite);
    assert.match(source, /buildVideoFixture\\(/u, suite);
    assert.doesNotMatch(source, /(?:async\\s+)?function\\s+videoFixture\\b/u, suite);
  }
});

test('shared fixture duration is at least twice the canonical maximum trim endpoint', () => {
  const fixture = readFileSync(SHARED_FIXTURE, 'utf8');
  const tool = readFileSync(resolve(ROOT, 'src/tools/video-local/index.tsx'), 'utf8');
  const durationMatch = fixture.match(/VIDEO_FIXTURE_DURATION_MS\\s*=\\s*(\\d[\\d_]*)/u);
  const endpointMatch = tool.match(/endSec:\\s*(\\d+(?:\\.\\d+)?)/u);
  assert.ok(durationMatch);
  assert.ok(endpointMatch);
  const durationMs = Number(durationMatch[1].replaceAll('_', ''));
  const endpointMs = Number(endpointMatch[1]) * 1000;
  assert.ok(durationMs >= endpointMs * 2, 'fixture=' + durationMs + 'ms endpoint=' + endpointMs + 'ms');
});
