import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { generateThirdPartyNotices } from '../../../scripts/generate-third-party-notices.mjs';

function putFile(root, relativePath, content) {
  const file = join(root, relativePath);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content);
}

test('third-party notice generation preserves root license and runtime package notices', () => {
  const root = mkdtempSync(join(tmpdir(), 'flixo-notice-fixture-'));
  try {
    putFile(root, 'LICENSE', 'Apache License Version 2.0\n');
    putFile(root, 'node_modules/runtime/LICENSE', 'runtime license\n');
    putFile(root, 'node_modules/runtime/NOTICE', 'runtime notice\n');
    putFile(root, 'node_modules/runtime/node_modules/nested/LICENSE-MIT', 'nested MIT license\n');
    putFile(root, 'node_modules/dev-only/LICENSE', 'development license\n');

    const lock = {
      lockfileVersion: 3,
      packages: {
        '': { name: 'fixture', version: '1.0.0', license: 'Apache-2.0' },
        'node_modules/runtime': { name: 'runtime', version: '1.0.0', license: 'MIT' },
        'node_modules/runtime/node_modules/nested': { name: 'nested', version: '2.0.0', license: '(MIT AND Zlib)' },
        'node_modules/dev-only': { name: 'dev-only', version: '1.0.0', license: 'MIT', dev: true },
        'node_modules/stale': { name: 'stale', version: '0.0.1', license: 'MIT', extraneous: true },
        'node_modules/workspace': { name: 'workspace', version: '1.0.0', license: 'Apache-2.0', link: true },
        'node_modules/missing-text': { name: 'missing-text', version: '1.0.0', license: 'Apache-2.0' },
      },
    };

    const report = generateThirdPartyNotices({ projectRoot: root, outputDir: 'dist', lock });
    assert.equal(report.runtimePackageCount, 3);
    assert.equal(report.packageEntriesWithoutRootLicenseOrNoticeFile, 1);
    assert.equal(readFileSync(join(root, 'dist', 'LICENSE'), 'utf8'), 'Apache License Version 2.0\n');

    const runtime = report.packages.find((item) => item.name === 'runtime');
    const nested = report.packages.find((item) => item.name === 'nested');
    const missing = report.packages.find((item) => item.name === 'missing-text');
    assert.equal(runtime.licenseFiles.length, 2);
    assert.equal(nested.licenseFiles.length, 1);
    assert.equal(missing.status, 'NO_LICENSE_TEXT_FOUND');
    assert.ok(existsSync(join(root, 'dist', runtime.licenseFiles[0])));
    assert.ok(readFileSync(join(root, 'dist', 'THIRD-PARTY-NOTICES.md'), 'utf8').includes('not legal clearance'));
    assert.equal(report.packages.some((item) => item.name === 'dev-only' || item.name === 'stale' || item.name === 'workspace'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('current runtime JSZip and Pako lock entries have preserved upstream license files', () => {
  const projectRoot = process.cwd();
  const lock = JSON.parse(readFileSync(resolve(projectRoot, 'package-lock.json'), 'utf8'));
  const outputDir = mkdtempSync(join(tmpdir(), 'flixo-notice-runtime-'));
  try {
    const report = generateThirdPartyNotices({ projectRoot, outputDir, lock });
    assert.ok(existsSync(join(outputDir, 'LICENSE')));
    assert.ok(existsSync(join(outputDir, 'THIRD-PARTY-NOTICES.md')));
    assert.ok(existsSync(join(outputDir, 'THIRD-PARTY-NOTICES.json')));

    const jszip = report.packages.find((item) => item.name === 'jszip' && item.version === '3.10.1');
    const pako = report.packages.find((item) => item.name === 'pako' && item.version === '1.0.11');
    assert.ok(jszip, 'the locked JSZip runtime dependency must be inventoried');
    assert.ok(pako, 'the locked Pako runtime dependency must be inventoried');
    assert.ok(jszip.licenseFiles.some((file) => file.toLowerCase().endsWith('license.markdown')));
    assert.ok(pako.licenseFiles.length > 0);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
