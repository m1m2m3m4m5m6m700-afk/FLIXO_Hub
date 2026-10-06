import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  TESSERACT_CORE_PATH,
  TESSERACT_LANG_DATA_VERSION,
  TESSERACT_LANG_PATHS,
  TESSERACT_MAIN_PATH,
  TESSERACT_VERSION,
  TESSERACT_WORKER_PATH,
} from '../src/tools/image-toolkit/ocr-worker-client.ts';

test('OCR runtime is locally pinned and has no mutable CDN main-runtime path', async () => {
  const source = await readFile('src/tools/image-toolkit/ocr-worker-client.ts', 'utf8');
  assert.equal(TESSERACT_VERSION, '6.0.1');
  assert.equal(TESSERACT_MAIN_PATH, '/vendor/tesseract/6.0.1/tesseract.min.js');
  assert.equal(TESSERACT_WORKER_PATH, '/vendor/tesseract/6.0.1/worker.min.js');
  assert.equal(TESSERACT_CORE_PATH, 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0');
  assert.equal(TESSERACT_LANG_DATA_VERSION, '4.0.0_best_int');
  assert.equal(TESSERACT_LANG_PATHS.eng, 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int');
  assert.equal(TESSERACT_LANG_PATHS.ara, 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/ara@1.0.0/4.0.0_best_int');
  assert.doesNotMatch(source, /@latest|@\^|@~/u);
  assert.doesNotMatch(source, /cdn\.jsdelivr\.net\/npm\/tesseract\.js@/u);
  assert.match(source, /workerBlobURL:\s*false/u);
  assert.match(source, /cacheMethod:\s*'none'/u);
  assert.match(source, /createWorker\(language, 1/u);
});

test('vendored Tesseract assets exist at the declared pinned paths', async () => {
  const [main, worker] = await Promise.all([
    readFile('public/vendor/tesseract/6.0.1/tesseract.min.js'),
    readFile('public/vendor/tesseract/6.0.1/worker.min.js'),
  ]);
  assert.ok(main.length > 50_000);
  assert.ok(worker.length > 100_000);
  assert.match(main.toString('utf8'), /Tesseract=u|exports\.createWorker/u);
  assert.match(worker.toString('utf8'), /workerId|loadLanguage|recognize/u);
});
