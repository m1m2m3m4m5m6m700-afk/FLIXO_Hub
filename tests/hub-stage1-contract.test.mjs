import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

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

function usesPersistentIdentifierStorage(source, path) {
  const scriptKind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, scriptKind);
  const forbiddenKeys = new Set(['localStorage', 'sessionStorage']);
  let found = false;

  function visit(node) {
    if (ts.isIdentifier(node) && forbiddenKeys.has(node.text)) found = true;

    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'document' &&
      node.name.text === 'cookie'
    ) found = true;

    if (ts.isElementAccessExpression(node) && node.argumentExpression) {
      const key = ts.isStringLiteralLike(node.argumentExpression) || ts.isIdentifier(node.argumentExpression)
        ? node.argumentExpression.text
        : '';
      if (forbiddenKeys.has(key)) found = true;
      if (
        key === 'cookie' &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'document'
      ) found = true;
    }

    ts.forEachChild(node, visit);
  }

  visit(file);
  return found;
}

test('Hub processing surface has no persistent identifier storage', () => {
  for (const path of hubFiles) {
    const source = readFileSync(path, 'utf8');
    assert.equal(usesPersistentIdentifierStorage(source, path), false, path);
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
