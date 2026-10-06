#!/usr/bin/env node
import { runArchitectureCheck } from './checks/architecture.mjs';
import { runLaunchReadinessCheck } from './checks/launch-readiness.mjs';

const checks = new Map([
  ['architecture', runArchitectureCheck],
  ['launch', runLaunchReadinessCheck],
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
  console.log(`\n[verify-all] ===== ${name} =====`);
  try {
    checks.get(name)();
    console.log(`[verify-all] ${name}=PASS`);
  } catch (error) {
    console.error(`[verify-all] ${name}=FAIL`);
    if (error instanceof Error) {
      console.error(error.message);
      if (Array.isArray(error.violations)) error.violations.forEach((entry) => console.error(entry));
      if (Array.isArray(error.missing)) error.missing.forEach((entry) => console.error(` - ${entry}`));
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

console.log(`\nVERIFY_ALL=PASS checks=${selected.join(',')}`);
