#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const REPO_OWNER = 'm1m2m3m4m5m6m700-afk';
export const REQUIRED_CODEOWNERS = Object.freeze({
  '/.github/workflows/': REPO_OWNER,
  '/.github/CODEOWNERS': REPO_OWNER,
  '/.github/agents/': REPO_OWNER,
  '/scripts/ci/': REPO_OWNER,
  '/SECURITY.md': REPO_OWNER,
  '/supabase/': REPO_OWNER,
  '/api/admin/': REPO_OWNER,
  '/src/server/admin/': REPO_OWNER,
  '/src/config/registry.ts': REPO_OWNER,
  '/src/lib/contracts/': REPO_OWNER,
  '/src/lib/execution/': REPO_OWNER,
  '/src/lib/agent-guided-runtime.ts': REPO_OWNER,
  '/src/worker.ts': REPO_OWNER,
  '/wrangler.jsonc': REPO_OWNER,
  '/vercel.json': REPO_OWNER,
});

export const CONDITIONALLY_ABSENT_PATHS = Object.freeze([
  '/src/lib/media/',
]);

function parseCodeowners(content) {
  const entries = [];
  const errors = [];
  const lines = content.split(/\r?\n/u);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const parts = trimmed.split(/\s+/u);
    const [pattern, ...owners] = parts;
    if (!pattern || owners.length === 0) {
      errors.push(`line ${lineNumber}: CODEOWNERS rule requires a pattern and at least one owner`);
      return;
    }
    if (pattern.startsWith('#')) {
      errors.push(`line ${lineNumber}: invalid comment placement`);
      return;
    }
    if (owners.some((owner) => !owner.startsWith('@'))) {
      errors.push(`line ${lineNumber}: owner must be a GitHub @owner token`);
      return;
    }
    if (pattern.includes('\\')) {
      errors.push(`line ${lineNumber}: backslash escapes are not accepted by the repository validator`);
      return;
    }
    entries.push({ lineNumber, pattern, owners });
  });

  const seen = new Map();
  for (const entry of entries) {
    if (!seen.has(entry.pattern)) seen.set(entry.pattern, []);
    seen.get(entry.pattern).push(entry.lineNumber);
  }
  for (const [pattern, lineNumbers] of seen) {
    if (lineNumbers.length > 1) errors.push(`duplicate CODEOWNERS pattern: ${pattern} on lines ${lineNumbers.join(', ')}`);
  }

  return { entries, errors };
}

export function validateCodeowners(content, { repoRoot = process.cwd(), owner = REPO_OWNER } = {}) {
  if (!content || !content.trim()) throw new Error('CODEOWNERS_EMPTY');

  const { entries, errors } = parseCodeowners(content);
  const byPattern = new Map(entries.map((entry) => [entry.pattern, entry]));
  const result = {
    ok: errors.length === 0,
    errors: [...errors],
    entries,
    covered: [],
    absent: [],
  };

  if (!byPattern.has('*')) result.errors.push('global fallback pattern `*` is missing');
  else if (!byPattern.get('*').owners.includes(`@${owner}`)) result.errors.push('global fallback owner mismatch');

  for (const [pattern, expectedOwner] of Object.entries(REQUIRED_CODEOWNERS)) {
    const absolute = resolve(repoRoot, `.${pattern}`);
    if (!existsSync(absolute)) {
      result.errors.push(`required CODEOWNERS target does not exist: ${pattern}`);
      continue;
    }
    const entry = byPattern.get(pattern);
    if (!entry) {
      result.errors.push(`required explicit CODEOWNERS coverage missing: ${pattern}`);
      continue;
    }
    if (entry.owners.length !== 1 || entry.owners[0] !== `@${expectedOwner}`) {
      result.errors.push(`owner mismatch for ${pattern}: expected @${expectedOwner}`);
      continue;
    }
    result.covered.push(pattern);
  }

  for (const pattern of CONDITIONALLY_ABSENT_PATHS) {
    const absolute = resolve(repoRoot, `.${pattern}`);
    if (!existsSync(absolute)) result.absent.push(pattern);
  }

  result.ok = result.errors.length === 0;
  return result;
}

export function main({ repoRoot = process.cwd(), file = resolve(repoRoot, '.github/CODEOWNERS') } = {}) {
  if (!existsSync(file)) throw new Error('CODEOWNERS_MISSING');
  const content = readFileSync(file, 'utf8');
  const result = validateCodeowners(content, { repoRoot });
  console.log(`CODEOWNERS_COVERAGE=${result.ok ? 'PASS' : 'FAIL'}`);
  console.log(`EXPLICIT_COVERAGE=${result.covered.length}/${Object.keys(REQUIRED_CODEOWNERS).length}`);
  if (result.absent.length) console.log(`ABSENT_REPOSITORY_PATHS=${result.absent.join(',')}`);
  if (!result.ok) {
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
  return result;
}

const invoked = process.argv[1] && resolve(fileURLToPath(pathToFileURL(process.argv[1])));
const modulePath = resolve(fileURLToPath(import.meta.url));
if (invoked === modulePath) main();
