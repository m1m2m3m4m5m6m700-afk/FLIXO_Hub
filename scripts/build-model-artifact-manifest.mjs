import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function walk(root, current = root, files = []) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`symbolic links are not allowed in model artifact sets: ${path.relative(root, absolute)}`);
    }
    if (entry.isDirectory()) {
      await walk(root, absolute, files);
    } else if (entry.isFile()) {
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const bytes = await fs.readFile(absolute);
      files.push({ path: relative, size_bytes: bytes.byteLength, sha256: sha256(bytes) });
    } else {
      throw new Error(`unsupported filesystem entry in model artifact set: ${path.relative(root, absolute)}`);
    }
  }
  return files;
}

export async function buildManifest(inputDirectory) {
  const root = path.resolve(inputDirectory);
  const rootStat = await fs.stat(root);
  if (!rootStat.isDirectory()) throw new Error('model artifact input must be a directory');

  const files = await walk(root);
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (files.length === 0) throw new Error('model artifact directory is empty');

  // The aggregate digest is SHA-256 over the canonical JSON array of sorted,
  // relative paths, byte lengths, and per-file SHA-256 values. It is not a
  // digest of a downloaded archive and must not be described as one.
  const canonical = JSON.stringify(files);
  return {
    schema_version: '1.0.0',
    algorithm: 'sha256',
    digest_algorithm: 'sha256(JSON.stringify(files))',
    file_count: files.length,
    total_size_bytes: files.reduce((sum, file) => sum + file.size_bytes, 0),
    artifact_sha256: sha256(Buffer.from(canonical, 'utf8')),
    files,
  };
}

async function main(args) {
  const input = args[0];
  if (!input || input.startsWith('--')) {
    throw new Error('usage: node scripts/build-model-artifact-manifest.mjs <model-directory> [--output <manifest.json>]');
  }
  let output;
  for (let index = 1; index < args.length; index += 1) {
    if (args[index] === '--output' && args[index + 1]) {
      output = args[index + 1];
      index += 1;
    } else {
      throw new Error(`unknown or incomplete argument: ${args[index]}`);
    }
  }
  const manifest = await buildManifest(input);
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  if (output) await fs.writeFile(path.resolve(output), json, { flag: 'wx' });
  else process.stdout.write(json);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`[model-artifact-manifest] BLOCKED: ${error.message}`);
    process.exitCode = 1;
  });
}
