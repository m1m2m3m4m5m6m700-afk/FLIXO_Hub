#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/run-python.mjs <script-or-python-args>');
  process.exit(2);
}
const configured = process.env.FLIXO_PYTHON;
const candidates = configured
  ? [configured]
  : process.platform === 'win32'
    ? ['py', 'python', 'python3']
    : ['python3', 'python'];
let lastMissing;
for (const executable of candidates) {
  const invocationArgs = executable === 'py' ? ['-3', ...args] : args;
  const result = spawnSync(executable, invocationArgs, { stdio: 'inherit', windowsHide: true });
  if (result.error?.code === 'ENOENT') {
    lastMissing = result.error;
    continue;
  }
  if (result.error) {
    console.error(`Unable to start Python (${executable}): ${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}
console.error(`Python interpreter not found. Tried: ${candidates.join(', ')}${lastMissing ? ` (${lastMissing.message})` : ''}`);
process.exit(127);
