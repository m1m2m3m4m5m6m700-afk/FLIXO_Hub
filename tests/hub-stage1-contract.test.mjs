import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hubFiles = [
  'src/core/feature-detection.ts',
  'src/core/opfs-store.ts',
  'src/core/worker-pool.ts',
  'src/core/hub-demo.worker.ts',
  'src/pages/hub-home.tsx',
  'src/pages/hub-privacy.tsx',
];

test('Hub processing surface has no direct network transport', () => {
  for (const path of hubFiles) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/u, path);
  }
});

test('Hub processing surface has no persistent identifier storage', () => {
  for (const path of hubFiles) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage|document\.cookie)\b/u, path);
  }
});

test('Hub worker path transfers the source ArrayBuffer', () => {
  const source = readFileSync('src/pages/hub-home.tsx', 'utf8');
  assert.match(source, /submit<\{ buffer: ArrayBuffer \}, DemoResult>/u);
  assert.match(source, /\[buffer\]/u);
});

test('Hub core exposes cancellation and progress', () => {
  const source = readFileSync('src/core/worker-pool.ts', 'utf8');
  assert.match(source, /cancel: \(\) => void/u);
  assert.match(source, /onProgress\?:/u);
  assert.match(source, /HubTaskProgress/u);
});

test('Hub OPFS store has a memory fallback', () => {
  const source = readFileSync('src/core/opfs-store.ts', 'utf8');
  assert.match(source, /mode: 'memory'/u);
  assert.match(source, /getDirectory\?/u);
});

test('production CSP is origin-only and omits referrers', () => {
  const worker = readFileSync('src/worker.ts', 'utf8');
  const vercel = readFileSync('vercel.json', 'utf8');
  const headers = readFileSync('_headers', 'utf8');
  for (const source of [worker, vercel, headers]) {
    assert.doesNotMatch(source, /cdn\.jsdelivr\.net/iu);
    assert.match(source, /connect-src[^\n;]*'self'/u);
    assert.doesNotMatch(source, /connect-src[^\n;]*https?:/iu);
    assert.doesNotMatch(source, /strict-origin-when-cross-origin/iu);
    assert.match(source, /no-referrer/iu);
  }
});

test('Tesseract no longer bootstraps an external script', () => {
  const source = readFileSync('src/tools/image-toolkit/ocr-worker-client.ts', 'utf8');
  assert.doesNotMatch(source, /createElement\(['"]script['"]\)/u);
  assert.doesNotMatch(source, /cdn\.jsdelivr\.net/iu);
});

test('Hub routes are materialized by the static build step', () => {
  const source = readFileSync('scripts/generate-static-route-entries.mjs', 'utf8');
  for (const route of ['/hub', '/hub/privacy', '/en/hub', '/en/hub/privacy']) {
    assert.match(source, new RegExp('copyEntry\\(' + route.replaceAll('/', '\\/') + '\\)'));
  }
});
