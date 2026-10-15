import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const NOTICE_FILE_PATTERN = /^(?:LICEN[CS]E|COPYING|NOTICE|PATENTS|UNLICENSE|COPYRIGHT|THIRD[-_ ]PARTY[-_ ]NOTICES?)(?:$|[._ -].*)/i;

function declaredLicense(value) {
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === 'string' ? item : item?.type || item?.url || 'UNKNOWN').join(' OR ') || 'UNKNOWN';
  }
  if (value && typeof value === 'object') return value.type || value.url || 'UNKNOWN';
  return typeof value === 'string' && value.trim() ? value.trim() : 'UNKNOWN';
}

function isWithin(parent, candidate) {
  const rel = relative(parent, candidate);
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel));
}

function packageFolder(name, version) {
  return (name + '@' + version)
    .replace(/^@/, '')
    .replace(/[\\/]+/g, '__')
    .replace(/[^A-Za-z0-9._@+-]/g, '_');
}

function packageNameFromLockPath(lockPath, entry) {
  return entry.name || lockPath.split('node_modules/').at(-1) || '';
}

export function generateThirdPartyNotices({
  projectRoot = process.cwd(),
  outputDir = 'dist',
  lock = null,
} = {}) {
  const root = resolve(projectRoot);
  const out = resolve(root, outputDir);
  const lockData = lock || JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));

  if (!lockData || lockData.lockfileVersion !== 3 || !lockData.packages || typeof lockData.packages !== 'object') {
    throw new Error('Expected a package-lock.json v3 packages map.');
  }

  const projectLicense = resolve(root, 'LICENSE');
  if (!existsSync(projectLicense)) throw new Error('Repository LICENSE file is missing.');

  mkdirSync(out, { recursive: true });
  copyFileSync(projectLicense, resolve(out, 'LICENSE'));

  const licenseOutputRoot = resolve(out, 'THIRD-PARTY-LICENSES');
  mkdirSync(licenseOutputRoot, { recursive: true });
  const packages = [];
  const copiedFiles = new Set();

  for (const [lockPath, entry] of Object.entries(lockData.packages)) {
    if (!lockPath || !entry || entry.link || entry.extraneous || entry.dev || !entry.version) continue;

    const name = packageNameFromLockPath(lockPath, entry);
    if (!name) continue;

    const packageDirectory = resolve(root, lockPath);
    if (!isWithin(root, packageDirectory)) {
      throw new Error('Dependency lock path escapes the repository root: ' + lockPath);
    }

    let sourceNames = [];
    if (existsSync(packageDirectory) && statSync(packageDirectory).isDirectory()) {
      sourceNames = readdirSync(packageDirectory, { withFileTypes: true })
        .filter((item) => item.isFile() && NOTICE_FILE_PATTERN.test(item.name))
        .map((item) => item.name)
        .sort((a, b) => a.localeCompare(b));
    }

    const targetDirectory = resolve(licenseOutputRoot, packageFolder(name, entry.version));
    if (!isWithin(licenseOutputRoot, targetDirectory)) {
      throw new Error('Dependency notice output path escapes its directory: ' + name);
    }
    mkdirSync(targetDirectory, { recursive: true });

    const licenseFiles = [];
    for (const sourceName of sourceNames) {
      const sourcePath = resolve(packageDirectory, sourceName);
      const targetPath = resolve(targetDirectory, sourceName);
      copyFileSync(sourcePath, targetPath);
      const targetRelativePath = relative(out, targetPath).split(sep).join('/');
      licenseFiles.push(targetRelativePath);
      copiedFiles.add(targetRelativePath);
    }

    packages.push({
      name,
      version: entry.version,
      declaredLicense: declaredLicense(entry.license),
      developmentOnly: false,
      optional: Boolean(entry.optional),
      lockPath,
      licenseFiles,
      status: licenseFiles.length ? 'LICENSE_FILES_INCLUDED' : 'NO_LICENSE_TEXT_FOUND',
    });
  }

  packages.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version) || a.lockPath.localeCompare(b.lockPath));
  const missingLicenseTextCount = packages.filter((item) => item.status === 'NO_LICENSE_TEXT_FOUND').length;
  const report = {
    schemaVersion: 1,
    source: 'package-lock.json',
    lockfileVersion: lockData.lockfileVersion,
    projectLicenseFile: 'LICENSE',
    runtimePackageCount: packages.length,
    packageEntriesWithoutRootLicenseOrNoticeFile: missingLicenseTextCount,
    copiedLicenseOrNoticeFileCount: copiedFiles.size,
    scopeNote: 'This is a mechanical build inventory, not proof of compatibility, ownership, complete provenance, or legal clearance. Packages without a copied root-level license or notice file need manual review; bundled assets and generated/copied source require separate review.',
    packages,
  };

  const markdown = [
    '# Third-Party Notices',
    '',
    'This distribution includes the FLIXO Hub license text in LICENSE. The files in THIRD-PARTY-LICENSES preserve license, notice, copying, patent, or unlicense files found at the roots of non-development package-lock entries.',
    '',
    '> This generated inventory is not legal clearance. It does not establish copyright ownership, license compatibility, completeness of bundled notices, or permission to redistribute. Packages marked NO_LICENSE_TEXT_FOUND require manual review. Inspect the actual bundles, worker runtime, copied assets, and applicable upstream notices before release.',
    '',
    '- Runtime package-lock entries considered: ' + report.runtimePackageCount,
    '- Distinct license/notice files copied: ' + report.copiedLicenseOrNoticeFileCount,
    '- Entries without a recognized root-level license/notice file: ' + report.packageEntriesWithoutRootLicenseOrNoticeFile,
    '',
    '| Package | Version | Declared license metadata | Included license/notice files | Status |',
    '|---|---|---|---|---|',
    ...packages.map((item) => {
      const files = item.licenseFiles.length
        ? item.licenseFiles.map((file) => '[' + file.split('/').at(-1) + '](' + file + ')').join('<br>')
        : 'No root-level license or notice file found';
      return '| ' + item.name.replaceAll('|', '\\|') + ' | ' + item.version.replaceAll('|', '\\|') + ' | ' + item.declaredLicense.replaceAll('|', '\\|') + ' | ' + files.replaceAll('|', '\\|') + ' | ' + item.status + ' |';
    }),
    '',
  ].join('\n');

  writeFileSync(resolve(out, 'THIRD-PARTY-NOTICES.md'), markdown + '\n');
  writeFileSync(resolve(out, 'THIRD-PARTY-NOTICES.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = generateThirdPartyNotices();
  console.log(
    'Third-party notices: copied ' + report.copiedLicenseOrNoticeFileCount +
    ' license/notice files for ' + report.runtimePackageCount +
    ' runtime package entries; ' + report.packageEntriesWithoutRootLicenseOrNoticeFile +
    ' entries require manual file/notice review.',
  );
}
