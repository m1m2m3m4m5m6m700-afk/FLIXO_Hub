import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/tools/image-toolkit/ocr-worker-client.ts'), 'utf8');
const failures = [];
const required = [
  "const TESSERACT_VERSION = '7.0.0'",
  'tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js',
  'tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js',
  'tesseract.js-core@${TESSERACT_VERSION}',
  "https://tessdata.projectnaptha.com/4.0.0",
  'workerBlobURL: false',
  'createWorker(language, 1',
];
for (const value of required) if (!source.includes(value)) failures.push('missing pinned OCR requirement: ' + value);
if (source.includes('tesseract.js@6')) failures.push('legacy moving/version-6 OCR URL remains');
if (/tesseract\.js@(?:latest|\^|~)/u.test(source)) failures.push('OCR dependency uses a floating version selector');
if (/document\.createElement\(['"]script['"]\)/u.test(source) && !source.includes('crossOrigin = \'anonymous\'')) failures.push('dynamic OCR script does not set CORS-compatible loading');
if (!source.includes('referrerPolicy = \'no-referrer\'')) failures.push('dynamic OCR script does not minimize referrer leakage');

if (failures.length) {
  console.error('[ocr-runtime-pinning] BLOCKED');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}
console.log('[ocr-runtime-pinning] PASS: Tesseract.js/Core and language data are pinned and worker blob fallback is disabled');