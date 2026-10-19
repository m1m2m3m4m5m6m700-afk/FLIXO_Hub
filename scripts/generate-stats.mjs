import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, 'public');
const DIST_DIR = join(ROOT, 'dist');

async function walk(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return walk(path);
      return [path];
    }));
    return nested.flat();
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

async function main() {
  const [categorySource, localeSource, toolEntries] = await Promise.all([
    readFile(join(ROOT, 'src/data/roadmap-categories.ts'), 'utf8'),
    readFile(join(ROOT, 'src/lib/i18n/config.ts'), 'utf8'),
    readdir(join(ROOT, 'src/tools'), { withFileTypes: true }),
  ]);

  const categories = countMatches(categorySource, /^\s*\{\s*id:\s*['"][^'"]+['"]/gm);
  const localeBlock = localeSource.match(/CANONICAL_LOCALES\s*=\s*\[([\s\S]*?)\]\s*as const/u)?.[1] ?? '';
  const localeCount = countMatches(localeBlock, /['"][a-z]{2}['"]/gu);
  const toolFolders = toolEntries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'));
  const toolMappedFlags = await Promise.all(toolFolders.map(async (entry) => {
    const dir = join(ROOT, 'src/tools', entry.name);
    const files = await readdir(dir).catch(() => []);
    return files.includes('manifest.ts') && files.includes('index.tsx');
  }));
  const toolsMapped = toolMappedFlags.filter(Boolean).length;

  const rawSha = process.env.GITHUB_SHA || (() => {
    try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); }
    catch { return 'unknown'; }
  })();
  const sha = /^[a-f0-9]{40}$/u.test(rawSha) ? rawSha : 'unknown';
  const env = (process.env.FLIXO_ENV || 'build').trim().toLowerCase();
  const distFiles = await walk(DIST_DIR);
  const indexPages = distFiles.filter((path) => path.endsWith('/index.html') || path.endsWith('\\index.html'));
  // The static-route generator creates one root entry, one /admin entry, one
  // landing page per locale, and one physical entry for each executable tool
  // per locale. Count the tool entries from the actual generated output.
  const liveNow = localeCount > 0 && indexPages.length >= localeCount + 2
    ? Math.floor((indexPages.length - localeCount - 2) / localeCount)
    : 0;

  const payload = { schemaVersion: 1, categories, toolsMapped, liveNow, sha, env };
  const canonical = JSON.stringify(payload);
  const statsHash = createHash('sha256').update(canonical).digest('hex');
  const output = JSON.stringify({ ...payload, statsHash }, null, 2) + '\n';

  await mkdir(PUBLIC_DIR, { recursive: true });
  await writeFile(join(PUBLIC_DIR, '__flixo-stats.json'), output, 'utf8');
  await mkdir(DIST_DIR, { recursive: true });
  await writeFile(join(DIST_DIR, '__flixo-stats.json'), output, 'utf8');

  console.log(`FLIXO_STATS categories=${categories} toolsMapped=${toolsMapped} liveNow=${liveNow} locales=${localeCount} indexPages=${indexPages.length} sha=${sha} env=${env} statsHash=${statsHash}`);
}

await main();
