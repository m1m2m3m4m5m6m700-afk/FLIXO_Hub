import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.github/CODEOWNERS');
if (!existsSync(path)) throw new Error('CODEOWNERS file is missing');
const source = readFileSync(path, 'utf8');
const required = [
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
  '/SECURITY.md',
  '/.github/agents/',
];
const lines = source.split(/\r?\n/u).map((line) => line.trim());
const missing = required.filter((entry) => !lines.some((line) => line.startsWith(entry + ' ') || line.startsWith(entry + '\t')));
if (missing.length) {
  console.error('[codeowners] BLOCKED: missing coverage');
  for (const entry of missing) console.error(' - ' + entry);
  process.exit(1);
}
console.log('[codeowners] PASS: required high-impact path entries are covered');