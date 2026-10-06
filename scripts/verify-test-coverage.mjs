import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const playwrightConfig = await readFile(path.join(root, 'playwright.config.ts'), 'utf8');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

const all = await walk(root);
const specs = all.filter(file => /\.spec\.ts$/.test(file));
const nodeTests = all.filter(file => /\.test\.ts$/.test(file));

const testDirMatch = playwrightConfig.match(/testDir\s*:\s*['"]([^'"]+)['"]/);
if (!testDirMatch) throw new Error('PLAYWRIGHT_TEST_COVERAGE: testDir is not declared');
const testDir = path.resolve(root, testDirMatch[1]);

const ignored = [];
const ignoreMatch = playwrightConfig.match(/testIgnore\s*:\s*\[([\s\S]*?)\]/);
if (ignoreMatch) {
  for (const m of ignoreMatch[1].matchAll(/['"]([^'"]+)['"]/g)) ignored.push(m[1]);
}
const isIgnored = file => ignored.some(pattern => {
  const normalized = path.relative(root, file).replaceAll(path.sep, '/');
  if (pattern.startsWith('**/')) return normalized.endsWith(pattern.slice(3));
  return normalized === pattern || normalized.endsWith('/' + pattern);
});

const coreScript = packageJson.scripts?.['test:core'] ?? '';
const coveredByCore = new Set(coreScript.split(/\s+/).filter(token => /\.test\.ts$/.test(token)));

const uncoveredSpecs = specs.filter(file => !file.startsWith(testDir + path.sep) || isIgnored(file));
const uncoveredNodeTests = nodeTests.filter(file => {
  const rel = path.relative(root, file).replaceAll(path.sep, '/');
  return !coveredByCore.has(rel);
});

if (uncoveredSpecs.length || uncoveredNodeTests.length) {
  console.error('TEST_COVERAGE_GATE=FAIL');
  if (uncoveredSpecs.length) console.error('Uncovered Playwright specs:\n' + uncoveredSpecs.map(f => path.relative(root, f)).join('\n'));
  if (uncoveredNodeTests.length) console.error('Uncovered Node test files:\n' + uncoveredNodeTests.map(f => path.relative(root, f)).join('\n'));
  process.exit(1);
}

console.log('TEST_COVERAGE_GATE=PASS');
console.log('PLAYWRIGHT_SPECS=' + specs.length);
console.log('NODE_TEST_FILES=' + nodeTests.length);
