import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { relative, resolve, join } from 'node:path';

const root = process.cwd();
const output = resolve(root, 'artifacts', 'flixo-local-site');
const site = resolve(output, 'site');

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}
function rel(path, base) { return relative(base, path).split('\\').join('/'); }

async function main() {
  assert.ok(await stat(resolve(site, 'index.html')).catch(() => null), 'site/index.html must exist');
  const worker = await readFile(resolve(site, 'sw.js'), 'utf8');
  const match = /const PRECACHE_URLS = (\[[\s\S]*?\]);/u.exec(worker);
  assert.ok(match, 'offline service worker must declare a precache URL list');
  const urls = JSON.parse(match[1]);
  assert.ok(Array.isArray(urls) && urls.includes('/index.html'), 'offline precache must include the SPA entry point');
  assert.ok(urls.includes('/en'), 'offline precache must include the English home route');
  assert.ok(!urls.some((url) => url.startsWith('/api/')), 'API endpoints must never be cached');

  const files = await walk(site);
  const expected = files.map((file) => rel(file, site))
    .filter((path) => !path.startsWith('api/') && path !== 'sw.js')
    .map((path) => '/' + path);
  const missing = expected.filter((url) => !urls.includes(url));
  assert.deepEqual(missing, [], 'all static files must be precached: ' + missing.join(', '));

  const manifest = (await readFile(resolve(output, 'SHA256SUMS.txt'), 'utf8')).trim().split(/\r?\n/u);
  const manifestMap = new Map(manifest.map((line) => {
    const match = /^([a-f0-9]{64}) {2}(.+)$/u.exec(line);
    assert.ok(match, 'invalid SHA256SUMS.txt row: ' + line);
    return [match[2], match[1]];
  }));
  const packageFiles = (await walk(output)).filter((file) => rel(file, output) !== 'SHA256SUMS.txt');
  assert.equal(manifestMap.size, packageFiles.length, 'every distributable package file must have exactly one hash');
  for (const file of packageFiles) {
    const path = rel(file, output);
    const actual = createHash('sha256').update(await readFile(file)).digest('hex');
    assert.equal(manifestMap.get(path), actual, 'SHA-256 mismatch for ' + path);
  }
  process.stdout.write('Local offline package verified: ' + packageFiles.length + ' package files, ' + expected.length + ' precached resources, all SHA-256 hashes valid; API endpoints excluded.\n');
}
main().catch((error) => {
  process.stderr.write('[verify-local-offline-package] FAIL: ' + (error?.stack || error) + '\n');
  process.exitCode = 1;
});
