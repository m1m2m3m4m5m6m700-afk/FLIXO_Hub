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

const PINNED_LICENSE_TEXT_FALLBACKS = Object.freeze({
  'isarray@1.0.0': Object.freeze({
    expectedLicense: 'MIT',
    sourcePath: 'LICENSES/third-party/isarray-1.0.0-MIT.txt',
    outputName: 'LICENSE.txt',
    sourceUrl: 'https://www.npmjs.com/package/isarray/v/1.0.0',
  }),
});

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
  const workspacePackages = [];
  const copiedFiles = new Set();

  for (const [lockPath, entry] of Object.entries(lockData.packages)) {
    if (!lockPath || !entry || entry.link || entry.extraneous || entry.dev || !entry.version) continue;

    const name = packageNameFromLockPath(lockPath, entry);
    if (!name) continue;

    const packageDirectory = resolve(root, lockPath);
    if (!isWithin(root, packageDirectory)) {
      throw new Error('Dependency lock path escapes the repository root: ' + lockPath);
    }

    if (!lockPath.startsWith('node_modules/')) {
      const workspaceManifestPath = resolve(packageDirectory, 'package.json');
      if (existsSync(workspaceManifestPath)) {
        const workspaceManifest = JSON.parse(readFileSync(workspaceManifestPath, 'utf8'));
        if (workspaceManifest.private === true) {
          workspacePackages.push({
            name,
            version: entry.version,
            declaredLicense: declaredLicense(entry.license),
            lockPath,
            status: 'PRIVATE_WORKSPACE_NOT_THIRD_PARTY_RIGHTS_UNVERIFIED',
          });
          continue;
        }
      }
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

    const sourceRootLicenseNoticeFound = sourceNames.length > 0;
    let status = licenseFiles.length ? 'LICENSE_FILES_INCLUDED' : 'NO_LICENSE_TEXT_FOUND';
    let licenseTextSource;
    if (status === 'NO_LICENSE_TEXT_FOUND') {
      const fallbackKey = name + '@' + entry.version;
      const fallback = PINNED_LICENSE_TEXT_FALLBACKS[fallbackKey];
      if (fallback) {
        const licenseMetadata = declaredLicense(entry.license);
        if (licenseMetadata !== fallback.expectedLicense) {
          throw new Error('Pinned license-text fallback metadata mismatch for ' + fallbackKey + ': ' + licenseMetadata);
        }
        const fallbackPath = resolve(root, fallback.sourcePath);
        if (!existsSync(fallbackPath) || !statSync(fallbackPath).isFile() || statSync(fallbackPath).size === 0) {
          throw new Error('Pinned license-text fallback is missing or empty for ' + fallbackKey + ': ' + fallback.sourcePath);
        }
        const targetPath = resolve(targetDirectory, fallback.outputName);
        copyFileSync(fallbackPath, targetPath);
        const targetRelativePath = relative(out, targetPath).split(sep).join('/');
        licenseFiles.push(targetRelativePath);
        copiedFiles.add(targetRelativePath);
        licenseTextSource = fallback.sourceUrl;
        status = 'LICENSE_TEXT_FALLBACK_INCLUDED';
      }
    }

    packages.push({
      name,
      version: entry.version,
      declaredLicense: declaredLicense(entry.license),
      developmentOnly: false,
      optional: Boolean(entry.optional),
      lockPath,
      rootLicenseNoticeFileFound: sourceRootLicenseNoticeFound,
      licenseFiles,
      ...(licenseTextSource ? { licenseTextSource } : {}),
      status,
    });
  }

  packages.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version) || a.lockPath.localeCompare(b.lockPath));
  workspacePackages.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version) || a.lockPath.localeCompare(b.lockPath));
  const missingLicenseTextCount = packages.filter((item) => item.status === 'NO_LICENSE_TEXT_FOUND').length;
  const missingSourceRootFileCount = packages.filter((item) => item.rootLicenseNoticeFileFound === false).length;
  const licenseTextFallbackCount = packages.filter((item) => item.status === 'LICENSE_TEXT_FALLBACK_INCLUDED').length;
  const report = {
    schemaVersion: 1,
    source: 'package-lock.json',
    lockfileVersion: lockData.lockfileVersion,
    projectLicenseFile: 'LICENSE',
    runtimePackageCount: packages.length,
    privateWorkspaceCount: workspacePackages.length,
    packageEntriesWithoutRootLicenseOrNoticeFile: missingSourceRootFileCount,
    packageEntriesWithoutAnyCopiedLicenseOrNoticeFile: missingLicenseTextCount,
    licenseTextFallbackCount,
    copiedLicenseOrNoticeFileCount: copiedFiles.size,
    scopeNote: 'This is a mechanical build inventory, not proof of compatibility, ownership, complete provenance, or legal clearance. Private first-party workspaces are listed separately and their rights remain unverified. Exact-version license-text fallbacks are copied only when declared license metadata matches the pinned entry; this is not legal clearance. Bundled assets and generated/copied source require separate review.',
    packages,
    workspaces: workspacePackages,
  };

  const markdown = [
    '# Third-Party Notices',
    '',
    'This distribution includes the FLIXO Hub license text in LICENSE. The files in THIRD-PARTY-LICENSES preserve license, notice, copying, patent, or unlicense files found at the roots of non-development package-lock entries.',
    '',
    '> This generated inventory is not legal clearance. It does not establish copyright ownership, license compatibility, completeness of bundled notices, or permission to redistribute. Packages marked NO_LICENSE_TEXT_FOUND require manual review. Inspect the actual bundles, worker runtime, copied assets, and applicable upstream notices before release.',
    '',
    '- Third-party runtime package-lock entries considered: ' + report.runtimePackageCount,
    '- Private first-party workspace packages tracked separately: ' + report.privateWorkspaceCount,
    '- Distinct license/notice files copied: ' + report.copiedLicenseOrNoticeFileCount,
    '- Entries without a source-root license/notice file: ' + report.packageEntriesWithoutRootLicenseOrNoticeFile,
    '- Entries without any copied license/notice text: ' + report.packageEntriesWithoutAnyCopiedLicenseOrNoticeFile,
    '- Exact-version license-text fallbacks included: ' + report.licenseTextFallbackCount,
    '',
    '| Package | Version | Declared license metadata | Included license/notice files | Status |',
    '|---|---|---|---|---|',
    ...packages.map((item) => {
      const files = item.licenseFiles.length
        ? item.licenseFiles.map((file) => '[' + file.split('/').at(-1) + '](' + file + ')').join('<br>')
        : 'No source-root license or notice file found';
      return '| ' + item.name.replaceAll('|', '\\|') + ' | ' + item.version.replaceAll('|', '\\|') + ' | ' + item.declaredLicense.replaceAll('|', '\\|') + ' | ' + files.replaceAll('|', '\\|') + ' | ' + item.status + ' |';
    }),
    '',
    '## Private first-party workspace packages (not third-party dependencies)',
    '',
    'These entries are tracked separately from external packages. Their presence and declared license metadata do not establish copyright ownership or relicensing authority.',
    '',
    '| Workspace | Version | Declared license metadata | Lock path | Status |',
    '|---|---|---|---|---|',
    ...workspacePackages.map((item) => '| ' + item.name.replaceAll('|', '\\|') + ' | ' + item.version.replaceAll('|', '\\|') + ' | ' + item.declaredLicense.replaceAll('|', '\\|') + ' | ' + item.lockPath.replaceAll('|', '\\|') + ' | ' + item.status + ' |'),
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
    ' third-party runtime entries; ' + report.packageEntriesWithoutAnyCopiedLicenseOrNoticeFile +
    ' entries have no copied license/notice text.',
  );
}
