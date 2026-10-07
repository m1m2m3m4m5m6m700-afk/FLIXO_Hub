import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { TOOL_MANIFEST } from '../src/config/tool-manifest.ts';
import { LOCALES } from '../src/lib/i18n/config.ts';
import { getLocalizedToolPath } from '../src/lib/routing/route-resolver.ts';

const DIST_DIR = process.env.FLIXO_DIST_DIR ?? 'dist';
const INDEX_FILE = join(DIST_DIR, 'index.html');

const executableTools = TOOL_MANIFEST.filter((tool) => tool.isReady && tool.capability.state === 'EXECUTABLE');
if (!executableTools.length) throw new Error('Static route generation requires at least one executable tool.');

const copyEntry = (route) => {
  const normalizedRoute = route.replace(/^\//u, '').replace(/\/$/u, '');
  const routeDir = normalizedRoute ? join(DIST_DIR, normalizedRoute) : DIST_DIR;
  mkdirSync(routeDir, { recursive: true });
  copyFileSync(INDEX_FILE, join(routeDir, 'index.html'));
};

// The production deployment is an immutable Vercel artifact. Materialize
// operational routes as physical entries so direct navigation cannot become
// a Vercel static 404.
copyEntry('/admin');

// Materialize the authenticated admin read boundary alongside the immutable
// artifact. Vercel detects the /api tree as serverless functions during deploy;
// these files stay isolated from the browser bundle.
const adminApiSourceDir = join('api', 'admin');
const adminApiDistDir = join(DIST_DIR, 'api', 'admin');
mkdirSync(adminApiDistDir, { recursive: true });
for (const file of ['boundary.ts', 'centers.ts', 'execution-preview.ts', 'overview.ts', 'session.ts']) {
  copyFileSync(join(adminApiSourceDir, file), join(adminApiDistDir, file));
}

for (const locale of LOCALES) {
  copyEntry(`/${locale}`);

  for (const tool of executableTools) {
    copyEntry(getLocalizedToolPath(tool, locale));
  }
}

console.log(`G1 static route entries generated: executable=${executableTools.length}, locales=${LOCALES.length}, routes=${executableTools.length * LOCALES.length + LOCALES.length + 1}, adminApi=5`);
