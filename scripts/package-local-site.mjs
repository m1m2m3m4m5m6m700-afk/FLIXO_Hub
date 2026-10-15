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
    'حزمة ملفات ثابتة محلية. لا تحتاج الواجهة أو وظائف المتصفح المدعومة إلى خدمة سحابية أثناء التشغيل.', '',
    '## التشغيل', '',
    '- يتطلب تشغيل الخادم Node.js 22.x.',
    '- افتح الطرفية داخل هذا المجلد وشغّل: node server.mjs.',
    '- افتح http://127.0.0.1:4173 في المتصفح.',
    '- لتغيير المنفذ في PowerShell: $env:FLIXO_LOCAL_PORT=4174; node server.mjs.',
    '- لا تستخدم file:// لأن بعض ميزات المتصفح تحتاج أصل HTTP محليًا.', '',
    '## حدود الوضع المحلي', '',
    '- تُحظر اتصالات الشبكة الخارجية عبر Content-Security-Policy، وتُعطّل مسارات /api/* عمدًا.',
    '- ميزات الإدارة والخدمات السحابية والميزات التي تتطلب API لن تعمل في هذا الوضع.',
    '- الحزمة لا تضم أدوات بناء المشروع أو حزم npm. البناء يحتاج مصدر المشروع واعتمادياته؛ تشغيل الحزمة بعد إنشائها يحتاج Node.js فقط.',
    '- لا يثبت هذا الأرشيف صلاحية إعادة توزيع الكود أو التبعيات أو الأصول. راجع التراخيص قبل مشاركة الحزمة أو نشرها.', '',
    '## هوية البناء', '',
    '- Source SHA: ' + sha,
    '- ملفات الموقع مدرجة في SHA256SUMS.txt.',
    '- هذه الحزمة ليست شهادة إصدار إنتاجي ولا تثبت اجتياز اختبارات المتصفح ما لم تُرفق أدلة مستقلة على SHA نفسه.', '',
  ].join('\n');
  await writeFile(resolve(output, 'README-AR.md'), readme, 'utf8');
  process.stdout.write('Local site package created: ' + relative(root, output) + '\n');
  process.stdout.write('Static files: ' + copiedFiles.length + '\n');
  process.stdout.write('Source SHA: ' + sha + '\n');
  process.stdout.write('External HTML/CSS runtime resources: none detected\n');
}
main().catch((error) => {
  process.stderr.write('[package-local-site] BLOCKED: ' + (error?.stack || error) + '\n');
  process.exitCode = 1;
});
