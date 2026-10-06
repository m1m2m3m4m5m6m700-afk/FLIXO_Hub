import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const sha = process.env.BUILD_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[0-9a-f]{40}$/u.test(sha)) throw new Error('Invalid build SHA for runtime evidence.');

const evidence = {
  schema: 'flixo.runtime-build-evidence.v1',
  sha,
  repository: process.env.GITHUB_REPOSITORY || 'local',
  workflow: process.env.GITHUB_WORKFLOW || 'local',
  runId: process.env.GITHUB_RUN_ID || null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
  event: process.env.GITHUB_EVENT_NAME || null,
  generatedAt: new Date().toISOString(),
  certification: {
    sourceOfTruth: 'runtime-build-artifact',
    staticMarkdownAttestation: false,
    exactShaBound: true,
  },
};

mkdirSync('dist/attestations', { recursive: true });
writeFileSync(
  'dist/attestations/build-evidence.json',
  JSON.stringify(evidence, null, 2) + '\n',
  'utf8',
);
