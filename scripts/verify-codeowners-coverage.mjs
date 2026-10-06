import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OWNER = '@m1m2m3m4m5m6m700-afk';
const CODEOWNERS_PATH = resolve('.github/CODEOWNERS');

const REQUIRED_PATTERNS = [
  '/.github/workflows/',
  '/.github/CODEOWNERS',
  '/scripts/ci/',
  '/supabase/',
  '/api/admin/',
  '/src/server/admin/',
  '/src/config/registry.ts',
  '/src/lib/contracts/',
  '/src/lib/execution/',
  '/src/lib/agent-guided-runtime.ts',
  '/src/lib/media/',
  '/src/worker.ts',
  '/wrangler.jsonc',
  '/vercel.json',
  '/SECURITY.md',
  '/.github/agents/',
];

if (!existsSync(CODEOWNERS_PATH)) {
  throw new Error('CODEOWNERS_MISSING');
}

const source = readFileSync(CODEOWNERS_PATH, 'utf8');
const lines = source.split(/\r?\n/u);
const activeLines = lines
  .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
  .filter(({ line }) => line && !line.startsWith('#'));

const malformed = activeLines.filter(({ line }) => {
  const fields = line.split(/\s+/u);
  return fields.length < 2 || fields.slice(1).some((owner) => !owner.startsWith('@'));
});
if (malformed.length) {
  throw new Error(
    'CODEOWNERS_SYNTAX_INVALID=' +
      malformed.map(({ lineNumber, line }) => `L${lineNumber}:${line}`).join('|'),
  );
}

const missing = REQUIRED_PATTERNS.filter(
  (pattern) =>
    !activeLines.some(({ line }) => {
      const fields = line.split(/\s+/u);
      return fields[0] === pattern;
    }),
);
if (missing.length) {
  throw new Error('CODEOWNERS_COVERAGE_MISSING=' + missing.join(','));
}

const wrongOwner = activeLines.filter(({ line }) => line.split(/\s+/u).slice(1).some((owner) => owner !== OWNER));
if (wrongOwner.length) {
  throw new Error(
    'CODEOWNERS_OWNER_MISMATCH=' +
      wrongOwner.map(({ lineNumber, line }) => `L${lineNumber}:${line}`).join('|'),
  );
}

console.log(`CODEOWNERS_COVERAGE_PASS=${REQUIRED_PATTERNS.length}`);
