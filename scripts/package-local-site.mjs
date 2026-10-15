import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve, relative, extname, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const dist = resolve(root, 'dist');
const output = resolve(root, 'artifacts', 'flixo-local-site');
const siteOutput = resolve(output, 'site');
const serverTemplate = resolve(dirname(fileURLToPath(import.meta.url)), 'local-site-server.mjs');

async function walk(dir) {
  const result = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) result.push(...await walk(path));
    else if (item.isFile()) result.push(path);
  }
  return result;
}
function assertLocalResourceReferences(html, file) {
  const tags = html.match(/<(?:script|img|iframe|video|audio|source|link)\b[^>]*>/giu) ?? [];
  for (const tag of tags) {
    const tagName = /^<([a-z]+)/iu.exec(tag)?.[1]?.toLowerCase();
    const isResourceLink = tagName === 'link' && /\brel=["'][^"']*(?:stylesheet|preload|modulepreload|icon|manifest|prefetch|preconnect)[^"']*["']/iu.test(tag);
    if (!['script', 'img', 'iframe', 'video', 'audio', 'source'].includes(tagName) && !isResourceLink) continue;
    if (/\b(?:src|href)=["']https?:\/\//iu.test(tag)) throw new Error('External runtime resource reference in ' + relative(root, file) + ': ' + tag);
  }
}
async function main() {
  if (!(await stat(dist).catch(() => null)) || !(await stat(resolve(dist, 'index.html')).catch(() => null))) {
    throw new Error('dist/index.html is missing. Run npm run build first.');
  }
  await rm(output, { recursive: true, force: true });
  await mkdir(siteOutput, { recursive: true });
  await cp(dist, siteOutput, { recursive: true, force: true });
  const copiedFiles = await walk(siteOutput);
  for (const file of copiedFiles) {
    if (extname(file).toLowerCase() === '.html') assertLocalResourceReferences(await readFile(file, 'utf8'), file);
    if (extname(file).toLowerCase() === '.css') {
      const css = await readFile(file, 'utf8');
      const urls = [...css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/giu)].map((match) => match[2].trim());
      const external = urls.find((url) => /^https?:\/\//iu.test(url) || url.startsWith('//'));
      if (external) throw new Error('External CSS resource in ' + relative(root, file) + ': ' + external);
      if (/@import\s+(?:url\()?['"]?https?:\/\//iu.test(css)) throw new Error('External CSS import in ' + relative(root, file));
    }
  }
  // Replace the generic network-first worker with a generated, self-contained offline cache.
  // API files are deliberately excluded: static files that happen to live under /api are not endpoints.
  const precacheUrls = ['/', '/index.html', '/en', ...copiedFiles
    .filter((file) => !relative(siteOutput, file).split('\\\\').join('/').startsWith('api/'))
    .filter((file) => relative(siteOutput, file).split('\\\\').join('/') !== 'sw.js')
    .map((file) => '/' + relative(siteOutput, file).split('\\\\').join('/'))];
  const uniquePrecacheUrls = [...new Set(precacheUrls)].sort();
  const offlineWorker = `const CACHE_NAME = 'flixo-local-offline-v1';
const PRECACHE_URLS = ${JSON.stringify(uniquePrecacheUrls)};
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('flixo-local-offline-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: 'API_UNAVAILABLE_IN_LOCAL_STATIC_MODE' }), { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } })));
    return;
  }
  const hasAmbientCredentials = request.headers.has('cookie') || request.headers.has('authorization');
  if (hasAmbientCredentials) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(request)) || (await caches.match('/index.html')) || new Response('Offline page unavailable', { status: 503 })));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok && response.type === 'basic') caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});
`;
  await writeFile(resolve(siteOutput, 'sw.js'), offlineWorker, 'utf8');
  await cp(serverTemplate, resolve(output, 'server.mjs'));
  const hashes = [];
  for (const file of await walk(siteOutput)) {
    const bytes = await readFile(file);
    hashes.push(createHash('sha256').update(bytes).digest('hex') + '  site/' + relative(siteOutput, file).split('\\').join('/'));
  }
  hashes.sort();
  await writeFile(resolve(output, 'SHA256SUMS.txt'), hashes.join('\n') + '\n', 'utf8');
  const sha = process.env.GITHUB_SHA || process.env.FLIXO_TARGET_SHA || 'LOCAL_BUILD_SHA_NOT_PROVIDED';
  const readme = [
    '# نسخة FLIXO Hub المحلية', '',
    'نسخة موقع محلية قابلة للتثبيت كـ PWA. عند أول فتح على الخادم المحلي، يخزّن Service Worker صفحات الموقع وأصوله المضمّنة للعمل دون اتصال لاحقًا.', '',
    '## التشغيل', '',
    '- يتطلب تشغيل الخادم Node.js 22.x.',
    '- افتح الطرفية داخل هذا المجلد وشغّل: node server.mjs.',
    '- افتح http://127.0.0.1:4173 في المتصفح.',
    '- لتغيير المنفذ في PowerShell: $env:FLIXO_LOCAL_PORT=4174; node server.mjs.',
    '- لا تستخدم file:// لأن بعض ميزات المتصفح تحتاج أصل HTTP محليًا.', '',
    '## حدود الوضع المحلي', '',
    '- تُحظر اتصالات الشبكة الخارجية عبر Content-Security-Policy، وتُعطّل مسارات /api/* عمدًا.',
    '- تُخزّن صفحات وأصول الواجهة في Service Worker محلي؛ يلزم فتح الموقع مرة على الأقل عبر الخادم المحلي لإكمال التخزين المؤقت.',
    '- ميزات الإدارة والخدمات السحابية والميزات التي تتطلب API لن تعمل في هذا الوضع.',
    '- الحزمة لا تضم أدوات بناء المشروع أو حزم npm. البناء يحتاج مصدر المشروع واعتمادياته؛ تشغيل الحزمة بعد إنشائها يحتاج Node.js فقط.',
    '- لا يثبت هذا الأرشيف صلاحية إعادة توزيع الكود أو التبعيات أو الأصول. راجع التراخيص قبل مشاركة الحزمة أو نشرها.', '',
    '## هوية البناء', '',
    '- Source SHA: ' + sha,
    '- ملفات الموقع مدرجة في SHA256SUMS.txt.',
    '- هذه الحزمة ليست شهادة إصدار إنتاجي ولا تثبت اجتياز اختبارات المتصفح ما لم تُرفق أدلة مستقلة على SHA نفسه.',
    '- يتحقق CI من قائمة التخزين المؤقت وبصمات الملفات قبل رفع الحزمة.', ''
    '## تشغيل سريع على Windows', '',
    '1. فك ضغط الحزمة بالكامل إلى مجلد عادي.',
    '2. شغّل START-FLIXO.bat بالنقر المزدوج. يتطلب Node.js 22.x مثبتًا مسبقًا.',
    '3. اترك نافذة الطرفية مفتوحة أثناء استخدام الموقع؛ أوقف الخادم عبر Ctrl+C.',
    '4. للتحقق من ملفات الموقع، شغّل: powershell -ExecutionPolicy Bypass -File .\\VERIFY-SHA256.ps1', '',
    'مهم: هذه نسخة واجهة محلية لمسارات الواجهة المضمنة، وليست بديلًا للخدمات الخلفية. تسجيل الدخول الإداري وواجهات /api/* والحفظ السحابي والذكاء الاصطناعي المستضاف لا تعمل دون اتصال، ولا يتم محاكاة نجاحها.', '',
  ].join('\n');
  await writeFile(resolve(output, 'README-AR.md'), readme, 'utf8');
  const windowsLauncher = [
    '@echo off',
    'setlocal',
    'cd /d "%~dp0"',
    'where node >nul 2>nul',
    'if errorlevel 1 (',
    '  echo FLIXO Hub needs Node.js 22.x to run this local website.',
    '  echo Install Node.js 22.x, then run this file again.',
    '  pause',
    '  exit /b 1',
    ')',
    'for /f "tokens=1 delims=.v" %%V in (\'node -p "process.versions.node"\') do set NODE_MAJOR=%%V',
    'if not "%NODE_MAJOR%"=="22" (',
    '  echo Detected Node.js version:',
    '  node --version',
    '  echo This package is validated for Node.js 22.x. Other versions may behave differently.',
    '  pause',
    '  exit /b 1',
    ')',
    'start "FLIXO Hub browser" http://127.0.0.1:4173/',
    'echo Starting FLIXO Hub locally at http://127.0.0.1:4173/',
    'echo Keep this window open while using the website. Press Ctrl+C to stop it.',
    'node server.mjs',
    'pause',
    ''
  ].join('\\r\\n');
  const verifyScript = String.raw`$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$manifest = Join-Path $PSScriptRoot 'SHA256SUMS.txt'
if (-not (Test-Path -LiteralPath $manifest)) { throw 'SHA256SUMS.txt is missing.' }
$failures = @()
foreach ($line in Get-Content -LiteralPath $manifest) {
  if ($line -match '^([a-fA-F0-9]{64})  (.+)
  process.stdout.write('Static files: ' + copiedFiles.length + '\n');
  process.stdout.write('Source SHA: ' + sha + '\n');
  process.stdout.write('External HTML/CSS runtime resources: none detected\n');
}
main().catch((error) => {
  process.stderr.write('[package-local-site] BLOCKED: ' + (error?.stack || error) + '\n');
  process.exitCode = 1;
});
) {
    $expected = $Matches[1].ToLowerInvariant()
    $relative = $Matches[2].Replace('/', [IO.Path]::DirectorySeparatorChar)
    $path = Join-Path $PSScriptRoot $relative
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { $failures += "MISSING: $relative"; continue }
    $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { $failures += "HASH MISMATCH: $relative" }
  } else { $failures += "INVALID MANIFEST LINE: $line" }
}
if ($failures.Count -gt 0) { $failures | ForEach-Object { Write-Error $_ }; exit 1 }
Write-Host 'PASS: all files listed in SHA256SUMS.txt match their SHA-256 hashes.'
`;
  await writeFile(resolve(output, 'START-FLIXO.bat'), windowsLauncher, 'utf8');
  await writeFile(resolve(output, 'VERIFY-SHA256.ps1'), verifyScript, 'utf8');
  process.stdout.write('Local site package created: ' + relative(root, output) + '\n');
  process.stdout.write('Static files: ' + copiedFiles.length + '\n');
  process.stdout.write('Source SHA: ' + sha + '\n');
  process.stdout.write('External HTML/CSS runtime resources: none detected\n');
}
main().catch((error) => {
  process.stderr.write('[package-local-site] BLOCKED: ' + (error?.stack || error) + '\n');
  process.exitCode = 1;
});
