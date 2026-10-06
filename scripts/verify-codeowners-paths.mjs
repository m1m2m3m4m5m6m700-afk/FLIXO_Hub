import { existsSync, statSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve('.github/CODEOWNERS');
const lines = readFileSync(file, 'utf8').split(/\\r?\\n/u);
const patterns = lines.map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => line.split(/\\s+/u)[0]);
const invalid = patterns.filter((pattern) => {
  if (pattern.includes('*')) return false;
  const target = resolve(pattern.replace(/^\\//u, ''));
  return !existsSync(target);
});
if (invalid.length) {
  console.error('[codeowners] INVALID_PATHS=' + invalid.join(','));
  process.exit(1);
}
console.log('[codeowners] PASS paths=' + patterns.length);
