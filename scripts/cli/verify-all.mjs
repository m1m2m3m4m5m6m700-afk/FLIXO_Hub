#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const checks = new Map([
  ['architecture', ['scripts/verify-architecture.mjs']],
  ['launch', ['scripts/verify-public-launch-readiness.mjs']],
]);

function usage() {
  console.log('Usage: node scripts/cli/verify-all.mjs [--architecture] [--launch]');
  console.log('Runs the selected FLIXO verification gates; with no flags, runs all gates.');
}

const args = new Set(process.argv.slice(2));
if (args.has('--help') || args.has('-h')) {
  usage();
  process.exit(0);
}

const unknown = [...args].filter((arg) => !['--architecture', '--launch'].includes(arg));
if (unknown.length) {
  console.error(`[verify-all] Unknown option(s): ${unknown.join(', ')}`);
  usage();
  process.exit(2);
}

const selected = args.size
  ? [...checks.keys()].filter((name) => args.has(`--${name}`))
  : [...checks.keys()];

for (const name of selected) {
  const [script] = checks.get(name);
  console.log(`\n[verify-all] ===== ${name} =====`);
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
    windowsHide: false,
  });

  if (result.error) {
    console.error(`[verify-all] ${name} failed to start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[verify-all] ${name} failed with exit code ${result.status ?? 1}`);
    process.exit(result.status ?? 1);
  }
  console.log(`[verify-all] ${name}=PASS`);
}

console.log(`\nVERIFY_ALL=PASS checks=${selected.join(',')}`);
