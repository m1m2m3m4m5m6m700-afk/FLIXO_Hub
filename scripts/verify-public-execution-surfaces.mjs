import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = resolve('public');
const failures = [];
const retiredFiles = ['flixo-tool-template.html'];
const executablePatterns = [
  ['createImageBitmap decode', /\bcreateImageBitmap\s*\(/u],
  ['canvas export', /\bcanvas\.toBlob\s*\(/u],
  ['file chooser', /<input\b[^>]+\btype\s*=\s*["']file["']/iu],
  ['FileReader', /\bnew\s+FileReader\s*\(/u],
  ['file object URL', /\bURL\.createObjectURL\s*\(/u],
  ['web worker', /\bnew\s+Worker\s*\(/u],
  ['OffscreenCanvas', /\bOffscreenCanvas\b/u],
];

for (const relativePath of retiredFiles) {
  if (existsSync(resolve(root, relativePath))) {
    failures.push(`retired public executable exists: public/${relativePath}`);
  }
}

function walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const filePath = resolve(dir, entry);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath);
      continue;
    }
    if (!/\.(html|js|jsx)$/iu.test(entry)) continue;

    const source = readFileSync(filePath, 'utf8');
    for (const [label, pattern] of executablePatterns) {
      if (pattern.test(source)) {
        failures.push(`public executable primitive (${label}): ${relative(process.cwd(), filePath).replace(/\\/g, '/')}`);
      }
    }
  }
}

walk(root);

if (failures.length) {
  console.error('[public-execution-surfaces] BLOCKED');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}

console.log('[public-execution-surfaces] PASS: public static surface contains no standalone file-processing executor primitives');
