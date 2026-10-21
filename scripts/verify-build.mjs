#!/usr/bin/env node
/**
 * Verifies the generated static build without modifying it.
 * Usage: node scripts/verify-build.mjs [dist-directory]
 * Optional: EXPECTED_SHA=<40-char git SHA> node scripts/verify-build.mjs
 *
 * This produces local verification evidence only; it does not certify a deployment.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'dist');
const errors = [];
const files = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      errors.push(`Symlink not allowed in build output: ${path.relative(root, full)}`);
    } else if (entry.isDirectory()) {
      await walk(full);
    } else if (entry.isFile()) {
      const bytes = await readFile(full);
      files.push({
        path: path.relative(root, full).split(path.sep).join('/'),
        size: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
  }
}

try {
  if (!(await stat(root)).isDirectory()) throw new Error('Build path is not a directory');
  await walk(root);
} catch (error) {
  console.error(`BUILD_VERIFY_FAILED: ${error.message}`);
  process.exit(1);
}

const required = ['robots.txt', 'sitemap.xml'];
for (const name of required) {
  if (!files.some((file) => file.path === name)) errors.push(`Missing required artifact: ${name}`);
}

const identityFiles = files.filter((file) =>
  /^__flixo-identity(?:-[0-9a-f]{40})?\.txt$/.test(path.posix.basename(file.path))
);
if (identityFiles.length === 0) errors.push('No root-level __flixo-identity*.txt file found');

const expectedSha = process.env.EXPECTED_SHA?.trim();
let declaredSha = null;
const headFile = files.find((file) => file.path === 'flixo-head-sha.txt');
if (headFile) declaredSha = (await readFile(path.join(root, headFile.path), 'utf8')).trim();

for (const file of identityFiles) {
  const value = (await readFile(path.join(root, file.path), 'utf8')).trim();
  if (!/^[0-9a-f]{40}$/.test(value)) errors.push(`Invalid SHA in ${file.path}`);
  if (expectedSha && value !== expectedSha) errors.push(`Identity mismatch in ${file.path}`);
  if (declaredSha && value !== declaredSha) errors.push(`Identity differs from flixo-head-sha.txt in ${file.path}`);
}
if (expectedSha && declaredSha && declaredSha !== expectedSha) {
  errors.push('flixo-head-sha.txt differs from EXPECTED_SHA');
}

files.sort((a, b) => a.path.localeCompare(b.path));
const inventoryHash = createHash('sha256')
  .update(files.map((file) => `${file.sha256}  ${file.path}\n`).join(''))
  .digest('hex');

const result = {
  status: errors.length ? 'FAIL' : 'PASS',
  evidenceType: 'BUILD_OUTPUT_VERIFICATION_NOT_DEPLOYMENT_CERTIFICATION',
  buildDirectory: root,
  expectedSha: expectedSha ?? null,
  declaredSha,
  fileCount: files.length,
  inventorySha256: inventoryHash,
  requiredArtifacts: Object.fromEntries(required.map((name) => [name, files.some((file) => file.path === name)])),
  identityFiles,
  errors,
  files,
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
