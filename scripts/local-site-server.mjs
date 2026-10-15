import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./site/', import.meta.url)));
const host = process.env.FLIXO_LOCAL_HOST || '127.0.0.1';
const port = Number(process.env.FLIXO_LOCAL_PORT || 4173);
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
};
const csp = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; manifest-src 'self'";

function send(res, status, body, contentType = 'text/plain; charset=utf-8', method = 'GET') {
  res.writeHead(status, {
    'Content-Type': contentType, 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': csp,
  });
  res.end(method === 'HEAD' ? undefined : body);
}
const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed\n', undefined, req.method);
  let url;
  try { url = new URL(req.url || '/', 'http://127.0.0.1'); }
  catch { return send(res, 400, 'Bad Request\n', undefined, req.method); }
  if (url.pathname.startsWith('/api/')) return send(res, 404, '{"error":"API_UNAVAILABLE_IN_LOCAL_STATIC_MODE"}\n', 'application/json; charset=utf-8', req.method);
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { return send(res, 400, 'Bad Request\n', undefined, req.method); }
  const targetPath = resolve(root, '.' + pathname);
  if (targetPath !== root && !targetPath.startsWith(root + sep)) return send(res, 403, 'Forbidden\n', undefined, req.method);
  let target = targetPath;
  if (existsSync(target) && statSync(target).isDirectory()) target = resolve(target, 'index.html');
  if (!existsSync(target) || !statSync(target).isFile()) {
    const looksLikeAsset = /\.[a-z0-9]{1,12}$/iu.test(pathname);
    if (looksLikeAsset || !existsSync(resolve(root, 'index.html'))) return send(res, 404, 'Not Found\n', undefined, req.method);
    target = resolve(root, 'index.html');
  }
  res.writeHead(200, {
    'Content-Type': mime[extname(target).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': extname(target) === '.html' ? 'no-cache' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': csp,
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(target).pipe(res);
});
server.listen(port, host, () => {
  process.stdout.write('FLIXO local site: http://' + host + ':' + port + '\n');
  process.stdout.write('External network connections are blocked by Content-Security-Policy; API routes are disabled.\n');
});
server.on('error', (error) => {
  process.stderr.write('Unable to start FLIXO local site: ' + error.message + '\n');
  process.exitCode = 1;
});
