import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function buildLicenseInventory(lock) {
  if (!lock || lock.lockfileVersion !== 3 || !lock.packages || typeof lock.packages !== 'object') {
    throw new Error('Expected a package-lock.json v3 packages map.');
  }

  const packages = [];
  const unresolved = [];

  for (const [lockPath, entry] of Object.entries(lock.packages)) {
    if (!lockPath || entry?.link) continue;
    const name = entry.name || lockPath.split('node_modules/').at(-1);
    if (!name || !entry.version) continue;

    let license = entry.license;
    if (Array.isArray(license)) {
      license = license.map((item) => typeof item === 'string' ? item : item?.type || item?.url || 'UNKNOWN').join(' OR ');
    } else if (license && typeof license === 'object') {
      license = license.type || license.url || 'UNKNOWN';
    }
    if (typeof license !== 'string' || !license.trim()) license = 'UNKNOWN';

    const status = license === 'UNKNOWN' || license === 'UNLICENSED' || /^SEE LICENSE IN\b/i.test(license)
      ? 'NEEDS_MANUAL_REVIEW'
      : 'METADATA_PRESENT_NOT_LEGAL_CLEARANCE';

    const item = {
      name,
      version: entry.version,
      license,
      developmentOnly: Boolean(entry.dev),
      optional: Boolean(entry.optional),
      resolved: entry.resolved || null,
      integrity: entry.integrity || null,
      status,
    };
    packages.push(item);
    if (status === 'NEEDS_MANUAL_REVIEW') unresolved.push(item);
  }

  packages.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  unresolved.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  return { schemaVersion: 1, lockfileVersion: lock.lockfileVersion, packageCount: packages.length, unresolvedCount: unresolved.length, packages, unresolved };
}

function renderMarkdown(report) {
  const lines = [
    '# Dependency License Metadata Inventory',
    '',
    'Generated from package-lock.json v' + report.lockfileVersion + '.',
    '',
    '- Package entries: ' + report.packageCount,
    '- Entries requiring manual license review: ' + report.unresolvedCount,
    '',
    '> This report inventories package-lock metadata only. It does not establish license compatibility, copyright ownership, NOTICE compliance, or permission to redistribute. Review every license expression and bundled asset before release.',
    '',
    '| Package | Version | License metadata | Scope | Review status |',
    '|---|---|---|---|---|',
    ...report.packages.map((p) => '| ' + p.name.replaceAll('|', '\\|') + ' | ' + p.version.replaceAll('|', '\\|') + ' | ' + p.license.replaceAll('|', '\\|') + ' | ' + (p.developmentOnly ? 'development' : 'runtime') + (p.optional ? ', optional' : '') + ' | ' + p.status + ' |'),
    '',
  ];
  return lines.join('\n');
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
  const report = buildLicenseInventory(lock);
  const outputDir = resolve(root, 'artifacts');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, 'dependency-license-inventory.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(resolve(outputDir, 'dependency-license-inventory.md'), renderMarkdown(report));
  console.log('Dependency license inventory: ' + report.packageCount + ' package entries; ' + report.unresolvedCount + ' require manual review.');
  if (report.unresolvedCount > 0) {
    console.error('Missing, UNLICENSED, or file-pointer license metadata must be resolved before release.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
