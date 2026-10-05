#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const allowed = new Set(['refs/heads/main', 'refs/heads/execution']);
const output = execFileSync('git', ['ls-remote', '--heads', 'origin'], { encoding: 'utf8' });
const unexpected = output
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.split(/\s+/u)[1])
  .filter((ref) => ref && !allowed.has(ref))
  .sort();

if (unexpected.length > 0) {
  console.error('BRANCH_POLICY=FAIL');
  console.error('Only refs/heads/main and refs/heads/execution are permitted.');
  console.error(unexpected.join('\n'));
  process.exit(1);
}

console.log('BRANCH_POLICY=PASS');
