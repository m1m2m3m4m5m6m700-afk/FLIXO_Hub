#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const scripts = {
  architecture: 'scripts/verify-architecture.mjs',
  launch: 'scripts/verify-public-launch-readiness.mjs',
};

const args = new Set(process.argv.slice(2));
const requested = args.size === 0
  ? ['architecture', 'launch']
  : [...args].filter((arg) => arg === '--architecture' || arg === '--launch')
      .map((arg) => arg.slice(2));

const invalid = [...args].filter((arg) => arg !== '--architecture' && arg !== '--launch');
if (invalid.length) {
  console.error(`Usage: node scripts/cli/verify-all.mjs [--architecture] [--launch]`);
  process.exit(2);
}

const failures = [];
for (const key of requested) {
  const script = scripts[key];
  console.log(`\n=== VERIFY ${key.toUpperCase()} ===`);
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  if (result.status !== 0) failures.push(key);
}

if (failures.length) {
  console.error(`VERIFY_ALL=FAIL: ${failures.join(', ')}`);
  process.exit(1);
}

console.log(`VERIFY_ALL=PASS: ${requested.join(', ')}`);
