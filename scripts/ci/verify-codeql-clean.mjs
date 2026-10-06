import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) throw new Error('CODEQL_SARIF_PATH_REQUIRED');

const document = JSON.parse(readFileSync(path, 'utf8'));
const findings = (document.runs ?? []).flatMap((run) => run.results ?? []);

if (findings.length !== 0) {
  const summary = findings
    .slice(0, 10)
    .map((finding) => ({
      rule: finding.ruleId ?? 'unknown',
      level: finding.level ?? 'unknown',
      message: finding.message?.text ?? 'no message',
    }));
  console.error(JSON.stringify({ code: 'CODEQL_FINDINGS', count: findings.length, sample: summary }, null, 2));
  process.exit(1);
}

console.log('CODEQL_FINDINGS=0');
