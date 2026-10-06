import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'src/tools/image-toolkit/ocr-worker-client.ts');
const source = fs.readFileSync(file, 'utf8');
const expected = 'https://cdn.jsdelivr.net/gh/naptha/tesseract.js@9d9b666/dist/tesseract.min.js';

if (!source.includes("const TESSERACT_CDN_URL = '" + expected + "';")) {
  throw new Error('OCR_RUNTIME_NOT_IMMUTABLY_PINNED');
}
if (/tesseract\.js@(?:latest|\^|~|\d+)(?![a-f0-9]{7,40})/i.test(source)) {
  throw new Error('OCR_MUTABLE_CDN_REFERENCE_DETECTED');
}
console.log(JSON.stringify({ status: 'PASS', immutableRuntimeUrl: expected }));
