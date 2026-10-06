import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const playwrightConfig = await readFile(path.join(root, 'playwright.config.ts'), 'utf8');

function walk(dir) {
  return readdir(dir, { withFileTypes: true }).then(async entries => {
    const files = [];
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...await walk(full));
      else files.push(full);
    }
    return files;
  });
}

const all = await walk(path.join(root, 'tests'));
const specFiles = all.filter(file => /\\.spec\\.ts$/.test(file));
const nodeTestFiles = all.filter(file => /\\.test\\.ts$/.test(file));

const testDirMatch = playwrightConfig.match(/testDir\\s*:\\s*['"]([^'"]+)['"]/);
if (!testDirMatch) throw new Error('PLAYWRIGHT_TEST_COVERAGE: testDir is not declared');
const testDir = path.resolve(root, testDirMatch[1]);

const ignored = [];
const ignoreMatch = playwrightConfig.match(/testIgnore\\s*:\\s*\\[([\\s\\S]*?)\\]/);
if (ignoreMatch) {
  for (const m of ignoreMatch[1].matchAll(/['"]([^'"]+)['"]/g)) ignored.push(m[1]);
}
const isIgnored = file => ignored.some(pattern => {
  const normalized = path.relative(root, file).replaceAll(path.sep, '/');
  if (pattern.startsWith('**/')) return normalized.endsWith(pattern.slice(3));
  return normalized === pattern || normalized.endsWith('/' + pattern);
});

const uncoveredSpecs = specFiles.filter(file => !file.startsWith(testDir + path.sep) || isIgnored(file));
const coreScript = packageJson.scripts?.['test:core'] ?? '';
const uncoveredNodeTests = nodeTestFiles.filter(file => {
  const rel = path.relative(root, file).replaceAll(path.sep, '/');
  return !coreScript.includes(rel);
});

if (uncoveredSpecs.length || uncoveredNodeTests.length) {
  console.error('TEST_COVERAGE_GATE=FAIL');
  if (uncoveredSpecs.length) console.error('Uncovered Playwright specs:\\n' + uncoveredSpecs.map(f => path.relative(root, f)).join('\\n'));
  if (uncoveredNodeTests.length) console.error('Uncovered Node test files:\\n' + uncoveredNodeTests.map(f => path.relative(root, f)).join('\\n'));
  process.exit(1);
}

console.log('TEST_COVERAGE_GATE=PASS');
console.log('PLAYWRIGHT_SPECS=' + specFiles.length);
console.log('NODE_TEST_FILES=' + nodeTestFiles.length);
