import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');

const ALLOWED_PUBLIC_FILES = new Set([
  'flixo-landing.html',
  'flixo-locale-bootstrap.js',
  'flixo-startup-bootstrap.js',
  'manifest.webmanifest',
  'robots.txt',
  'sw.js',
]);

const EXECUTION_PRIMITIVES = [
  /createImageBitmap\s*\(/,
  /MediaRecorder\b/,
  /canvas\.getContext\s*\(/,
  /FileReader\b/,
  /URL\.createObjectURL\s*\(/,
  /executeCanonicalTool\b/,
  /TOOL_REGISTRY\b/,
  /getToolChainAdapter\b/,
  /tesseract(?:\.js)?/i,
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return [absolute];
  });
}

if (!fs.existsSync(PUBLIC_DIR)) throw new Error('PUBLIC_DIR_MISSING');

const relativeFiles = walk(PUBLIC_DIR)
  .map((file) => path.relative(PUBLIC_DIR, file).replaceAll(path.sep, '/'))
  .sort();

const unexpected = relativeFiles.filter((file) => !ALLOWED_PUBLIC_FILES.has(file));
if (unexpected.length) {
  throw new Error('PUBLIC_SURFACE_NOT_ALLOWLISTED: ' + unexpected.join(', '));
}

if (relativeFiles.includes('flixo-tool-template.html')) {
  throw new Error('LEGACY_EXECUTABLE_SURFACE_PRESENT');
}

for (const file of relativeFiles) {
  const absolute = path.join(PUBLIC_DIR, file);
  const source = fs.readFileSync(absolute, 'utf8');
  if (EXECUTION_PRIMITIVES.some((pattern) => pattern.test(source))) {
    throw new Error('PUBLIC_EXECUTION_PRIMITIVE_DETECTED: ' + file);
  }
}

console.log(JSON.stringify({
  status: 'PASS',
  checkedFiles: relativeFiles,
  legacyExecutableAbsent: true,
  canonicalExecutionPrimitivesAbsent: true,
}));
