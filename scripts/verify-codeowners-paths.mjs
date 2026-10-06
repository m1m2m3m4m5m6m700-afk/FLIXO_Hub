import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.github/CODEOWNERS');
const patterns = readFileSync(path, 'utf8')
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split(/\s+/u)[0]);

const invalid = patterns.filter((pattern) => {
  if (pattern.includes('*')) return false;
  const target = resolve(pattern.replace(/^\//u, '').replace(/\/$/u, ''));
  if (!existsSync(target)) return true;
  if (pattern.endsWith('/')) return !statSync(target).isDirectory();
  return !statSync(target).isFile();
});

if (invalid.length) {
  console.error('[codeowners] INVALID_PATHS=' + invalid.join(','));
  process.exit(1);
}

console.log('[codeowners] PASS paths=' + patterns.length);
