import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/tools/image-toolkit/ocr-worker-client.ts'), 'utf8');
const failures = [];

const required = [
  "const TESSERACT_VERSION = '7.0.0'",
  "const TESSERACT_SCRIPT_SRI = 'sha384-2BQ3U3OdKOb0Uczxqr41I9UvZkzr4V9Hv8uSzMMZAlmhsFClvdZX5wi5fDCzG+tM'",
  'tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js',
  'tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js',
  'tesseract.js-core@${TESSERACT_VERSION}',
  'https://tessdata.projectnaptha.com/4.0.0',
  "script.crossOrigin = 'anonymous'",
  'script.integrity = TESSERACT_SCRIPT_SRI',
  "script.referrerPolicy = 'no-referrer'",
  'workerBlobURL: false',
  'createWorker(language, 1',
];

for (const value of required) {
  if (!source.includes(value)) failures.push('missing pinned OCR requirement: ' + value);
}

if (/tesseract\.js@(?:latest|\^|~)/u.test(source)) failures.push('OCR dependency uses a floating version selector');
if (/tesseract\.js-core@(?:latest|\^|~)/u.test(source)) failures.push('OCR core dependency uses a floating version selector');
if (/tessdata\.projectnaptha\.com\/(?:latest|main|master)/iu.test(source)) failures.push('OCR language data URL is not immutable');
if (source.includes("document.createElement('script')") && !source.includes('script.integrity = TESSERACT_SCRIPT_SRI')) failures.push('dynamic OCR script is missing SRI');
if (!source.includes('workerBlobURL: false')) failures.push('OCR worker blob fallback is enabled');
if (source.includes('tesseract.js@6')) failures.push('legacy version-6 OCR URL remains');

if (failures.length) {
  console.error('[ocr-runtime-pinning] BLOCKED');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}

console.log('[ocr-runtime-pinning] PASS: Tesseract.js v7.0.0 is version-pinned; main script uses SRI; worker blob fallback is disabled');
