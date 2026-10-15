import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, readFile, rm, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const sourceServer = resolve(fileURLToPath(new URL('../scripts/local-site-server.mjs', import.meta.url)));

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate a local test port');
  await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
  return address.port;
}

test('local offline server serves SPA locally, disables APIs, and applies restrictive CSP', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'flixo-local-site-'));
  const port = await freePort();
  const site = join(directory, 'site');
  await mkdir(site, { recursive: true });
  await writeFile(join(site, 'index.html'), '<!doctype html><title>FLIXO local smoke</title><main>local</main>', 'utf8');
  await writeFile(join(site, 'app.js'), 'console.log("local");', 'utf8');
  await cp(sourceServer, join(directory, 'server.mjs'));
  const child = spawn(process.execPath, [join(directory, 'server.mjs')], {
    env: { ...process.env, FLIXO_LOCAL_HOST: '127.0.0.1', FLIXO_LOCAL_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  t.after(async () => {
    child.kill();
    await rm(directory, { recursive: true, force: true });
  });

  const origin = 'http://127.0.0.1:' + port;
  let response;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { response = await fetch(origin + '/'); break; }
    catch { await new Promise((resolveDelay) => setTimeout(resolveDelay, 50)); }
  }
  assert.ok(response, 'server did not start: ' + output);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /FLIXO local smoke/u);
  assert.match(response.headers.get('content-security-policy') || '', /connect-src 'self'/u);
  assert.match(response.headers.get('content-security-policy') || '', /script-src 'self'/u);

  const route = await fetch(origin + '/en/tools/example');
  assert.equal(route.status, 200, 'SPA route should resolve to index.html');
  assert.match(await route.text(), /FLIXO local smoke/u);

  const asset = await fetch(origin + '/app.js');
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type') || '', /javascript/u);

  const api = await fetch(origin + '/api/admin/session');
  assert.equal(api.status, 404);
  assert.match(await api.text(), /API_UNAVAILABLE_IN_LOCAL_STATIC_MODE/u);

  const missingAsset = await fetch(origin + '/missing.js');
  assert.equal(missingAsset.status, 404);
});
