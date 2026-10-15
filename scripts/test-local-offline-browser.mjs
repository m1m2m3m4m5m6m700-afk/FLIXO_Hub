import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const packageRoot = resolve(process.cwd(), 'artifacts', 'flixo-local-site');
const serverPath = resolve(packageRoot, 'server.mjs');

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Unable to allocate local port');
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return address.port;
}

async function waitForServer(origin, child) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error('Local server exited before startup with code ' + child.exitCode);
    try {
      const response = await fetch(origin + '/');
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error('Local package server did not become ready');
}

const port = await freePort();
const origin = 'http://127.0.0.1:' + port;
const server = spawn(process.execPath, [serverPath], {
  env: { ...process.env, FLIXO_LOCAL_HOST: '127.0.0.1', FLIXO_LOCAL_PORT: String(port) },
  stdio: 'ignore',
});
let browser;
try {
  await waitForServer(origin, server);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const externalRequests = [];
  context.on('request', (request) => {
    if (!request.url().startsWith(origin + '/') && !request.url().startsWith(origin)) externalRequests.push(request.url());
  });
  const page = await context.newPage();
  await page.goto(origin + '/ar', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 20000 });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15000 });

  const cacheState = await page.evaluate(async () => {
    const keys = await caches.keys();
    const cache = await caches.open('flixo-local-offline-v1');
    const requests = await cache.keys();
    return {
      keys,
      requestCount: requests.length,
      hasEntryPoint: Boolean(await cache.match('/index.html')),
      hasAppAssets: requests.some((request) => new URL(request.url).pathname.startsWith('/assets/')),
      cachedApi: requests.some((request) => new URL(request.url).pathname.startsWith('/api/')),
    };
  });
  assert.ok(cacheState.keys.includes('flixo-local-offline-v1'), 'offline cache was not installed');
  assert.ok(cacheState.hasEntryPoint, 'SPA entry point is not cached');
  assert.ok(cacheState.hasAppAssets, 'bundled app assets are not cached');
  assert.equal(cacheState.cachedApi, false, 'API endpoints must never be cached');

  await context.setOffline(true);
  await page.goto(origin + '/ar/image-cropper', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 15000 });
  const offlineTitle = await page.title();
  assert.match(offlineTitle, /FLIXO/iu, 'offline route did not render the app shell');
  const apiResponse = await page.evaluate(async () => {
    try {
      const response = await fetch('/api/admin/session');
      return { status: response.status, body: await response.text() };
    } catch (error) {
      return { status: 0, body: String(error) };
    }
  });
  assert.equal(apiResponse.status, 503, 'API requests must fail closed while offline');
  assert.deepEqual(externalRequests, [], 'local offline website attempted external network requests');
  process.stdout.write(JSON.stringify({
    result: 'PASS',
    sourceSha: process.env.FLIXO_TARGET_SHA || 'CI_SHA_NOT_PROVIDED',
    cachedResources: cacheState.requestCount,
    offlineRouteTitle: offlineTitle,
    apiOfflineStatus: apiResponse.status,
    externalRequests: externalRequests.length,
  }, null, 2) + '\n');
} finally {
  await browser?.close();
  server.kill();
}
