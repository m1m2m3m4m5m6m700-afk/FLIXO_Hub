type AssetsBinding = { fetch(request: Request): Promise<Response> };
type Env = { ASSETS: AssetsBinding; FLIXO_DEPLOYMENT_SHA?: string };
const SHA_PATTERN = /^[a-f0-9]{40}$/u;
const VERSIONED_IDENTITY_PATTERN = /^\/__flixo-identity-([a-f0-9]{40})\.txt$/u;
const DIRECTORY_IDENTITY_PATTERN = /^\/__flixo\/identity\/([a-f0-9]{40})\/index\.txt$/u;
const BUILD_PROVENANCE_PATH = '/__flixo/build-provenance.json';
const EXPECTED_REPOSITORY = 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';
const EMBEDDED_DEPLOYMENT_SHA = '__FLIXO_DEPLOYMENT_SHA__';
export function resolveDeploymentIdentity(requestedSha:string, deploymentSha:string):string|null {
  if(!SHA_PATTERN.test(requestedSha) || !SHA_PATTERN.test(deploymentSha) || requestedSha !== deploymentSha) return null;
  return requestedSha;
}
const SECURITY_HEADERS: Record<string, string> = Object.freeze({
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; manifest-src 'self'",
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()', 'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
});
function secure(response: Response, deploymentSha?: string): Response { const headers = new Headers(response.headers); for (const [k,v] of Object.entries(SECURITY_HEADERS)) headers.set(k,v); if (deploymentSha && SHA_PATTERN.test(deploymentSha)) headers.set('x-flixo-deployment-sha', deploymentSha); return new Response(response.body,{status:response.status,statusText:response.statusText,headers}); }
function apiNotFound(): Response { return secure(new Response(JSON.stringify({error:'API_NOT_EXPOSED_ON_STATIC_PRODUCTION_WORKER'})+'\n',{status:404,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, max-age=0'}})); }
function identityResponse(sha:string): Response { return secure(new Response(sha+'\n',{status:200,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store, max-age=0','x-flixo-deployment-sha':sha}})); }
function identity404():Response { return secure(new Response('Not Found\n',{status:404,headers:{'content-type':'text/plain','cache-control':'no-store'}})); }
function provenanceNotFound(): Response {
  return secure(new Response(JSON.stringify({ error: 'BUILD_PROVENANCE_NOT_AVAILABLE_OR_MISMATCHED' }) + '\n', {
    status: 404,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
    },
  }));
}
async function verifyBuildProvenance(deploymentSha: string, request: Request, assets: AssetsBinding): Promise<Response> {
  if (!SHA_PATTERN.test(deploymentSha)) return provenanceNotFound();
  const asset = await assets.fetch(request);
  if (asset.status !== 200 || !(asset.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    return provenanceNotFound();
  }
  let value: unknown;
  try {
    value = await asset.json();
  } catch {
    return provenanceNotFound();
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return provenanceNotFound();
  const provenance = value as Record<string, unknown>;
  if (
    provenance.repository !== EXPECTED_REPOSITORY
    || provenance.candidateSha !== deploymentSha
    || typeof provenance.sourceTreeSha !== 'string'
    || !SHA_PATTERN.test(provenance.sourceTreeSha)
    || typeof provenance.buildRunId !== 'string'
    || !/^\d+$/u.test(provenance.buildRunId)
  ) {
    return provenanceNotFound();
  }
  return secure(new Response(JSON.stringify({
    repository: EXPECTED_REPOSITORY,
    candidateSha: deploymentSha,
    sourceTreeSha: provenance.sourceTreeSha,
    buildRunId: provenance.buildRunId,
  }) + '\n', {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'x-flixo-deployment-sha': deploymentSha,
    },
  }));
}
async function verifyIdentity(requestedSha:string,deploymentSha:string,request:Request,assets:AssetsBinding):Promise<Response> {
  const verifiedSha = resolveDeploymentIdentity(requestedSha, deploymentSha);
  if (!verifiedSha) return identity404();
  const asset = await assets.fetch(request);
  if (asset.status !== 200) return identity404();
  const body = (await asset.text()).trim();
  return body === verifiedSha ? identityResponse(verifiedSha) : identity404();
}
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/')) return apiNotFound();
  if(url.pathname === BUILD_PROVENANCE_PATH) return verifyBuildProvenance(env.FLIXO_DEPLOYMENT_SHA ?? EMBEDDED_DEPLOYMENT_SHA, request, env.ASSETS);
  const versioned=url.pathname.match(VERSIONED_IDENTITY_PATTERN);
  if(versioned) return verifyIdentity(versioned[1], env.FLIXO_DEPLOYMENT_SHA ?? EMBEDDED_DEPLOYMENT_SHA, request, env.ASSETS);
  const directory=url.pathname.match(DIRECTORY_IDENTITY_PATTERN);
  if(directory) return verifyIdentity(directory[1], env.FLIXO_DEPLOYMENT_SHA ?? EMBEDDED_DEPLOYMENT_SHA, request, env.ASSETS);
  if(url.pathname.startsWith('/__flixo-identity-')||url.pathname.startsWith('/__flixo/identity/')) return secure(new Response('Not Found\n',{status:404}));
  return secure(await env.ASSETS.fetch(request), env.FLIXO_DEPLOYMENT_SHA);
 },
};
