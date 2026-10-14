import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker, { resolveDeploymentIdentity } from '../src/worker.ts';

test('deployment identity resolver requires an exact 40-character SHA match', () => {
  const sha = 'a'.repeat(40);
  assert.equal(resolveDeploymentIdentity(sha, sha), sha);
  assert.equal(resolveDeploymentIdentity(sha, 'b'.repeat(40)), null);
  assert.equal(resolveDeploymentIdentity(sha, 'a'.repeat(39)), null);
});

test('production worker applies the complete security-header contract', async () => {
  const response = await worker.fetch(
    new Request('https://flixoai.example/'),
    {
      ASSETS: {
        fetch: async () =>
          new Response('<html></html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(
    response.headers.get('strict-transport-security'),
    'max-age=63072000; includeSubDomains; preload',
  );
  assert.equal(
    response.headers.get('permissions-policy'),
    'geolocation=(), microphone=(), camera=()',
  );
  const csp = response.headers.get('content-security-policy') ?? '';
  assert.match(csp, /default-src 'self'/u);
  assert.match(csp, /object-src 'none'/u);
  assert.match(csp, /frame-ancestors 'none'/u);
  assert.match(csp, /worker-src 'self' blob:/u);
});

test('production worker returns JSON 404 for API paths instead of SPA HTML', async () => {
  const response = await worker.fetch(new Request('https://flixoai.example/api/flixo-agent'), { ASSETS: { fetch: async () => { throw new Error('API asset fallback must not run'); } } });
  assert.equal(response.status, 404);
  assert.equal((response.headers.get('content-type') ?? '').includes('application/json'), true);
  assert.equal((await response.json() as { error: string }).error, 'API_NOT_EXPOSED_ON_STATIC_PRODUCTION_WORKER');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('production worker rejects identity before deploy-time SHA binding', async () => {
  const requested = 'a'.repeat(40);
  const response = await worker.fetch(new Request('https://flixoai.example/__flixo-identity-' + requested + '.txt'), {
    ASSETS: { fetch: async () => new Response(requested + '\n', { status: 200 }) },
  });
  assert.equal(response.status, 404);
});

test('production worker rejects identity when the exact versioned asset does not match', async () => {
  const requested = 'a'.repeat(40);
  const response = await worker.fetch(new Request('https://flixoai.example/__flixo-identity-' + requested + '.txt'), {
    ASSETS: { fetch: async (request) => {
      assert.equal(new URL(request.url).pathname, '/__flixo-identity-' + requested + '.txt');
      return new Response('b'.repeat(40) + '\n', { status: 200 });
    } },
  });
  assert.equal(response.status, 404);
});


test('production worker serves JSON build provenance only when the exact deployed SHA matches', async () => {
  const deploymentSha = 'a'.repeat(40);
  const sourceTreeSha = 'b'.repeat(40);
  const provenance = {
    repository: 'm1m2m3m4m5m6m700-afk/FLIXO_Hub',
    candidateSha: deploymentSha,
    sourceTreeSha,
    buildRunId: '12345',
  };
  const response = await worker.fetch(new Request('https://flixoai.example/__flixo/build-provenance.json'), {
    FLIXO_DEPLOYMENT_SHA: deploymentSha,
    ASSETS: {
      fetch: async (request) => {
        assert.equal(new URL(request.url).pathname, '/__flixo/build-provenance.json');
        return new Response(JSON.stringify(provenance), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      },
    },
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /application\\/json/u);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(response.headers.get('x-flixo-deployment-sha'), deploymentSha);
  assert.deepEqual(await response.json(), provenance);
});

test('production worker rejects SPA HTML fallback at the build provenance path', async () => {
  const deploymentSha = 'a'.repeat(40);
  const response = await worker.fetch(new Request('https://flixoai.example/__flixo/build-provenance.json'), {
    FLIXO_DEPLOYMENT_SHA: deploymentSha,
    ASSETS: {
      fetch: async () => new Response('<!doctype html><html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    },
  });

  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type') ?? '', /application\\/json/u);
  assert.equal((await response.json() as { error: string }).error, 'BUILD_PROVENANCE_NOT_AVAILABLE_OR_MISMATCHED');
});

test('production worker rejects provenance for a different candidate or invalid source tree', async () => {
  const deploymentSha = 'a'.repeat(40);
  const candidates = [
    {
      repository: 'm1m2m3m4m5m6m700-afk/FLIXO_Hub',
      candidateSha: 'b'.repeat(40),
      sourceTreeSha: 'c'.repeat(40),
      buildRunId: '12345',
    },
    {
      repository: 'm1m2m3m4m5m6m700-afk/FLIXO_Hub',
      candidateSha: deploymentSha,
      sourceTreeSha: 'not-a-sha',
      buildRunId: '12345',
    },
  ];

  for (const provenance of candidates) {
    const response = await worker.fetch(new Request('https://flixoai.example/__flixo/build-provenance.json'), {
      FLIXO_DEPLOYMENT_SHA: deploymentSha,
      ASSETS: {
        fetch: async () => new Response(JSON.stringify(provenance), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      },
    });
    assert.equal(response.status, 404);
  }
});

