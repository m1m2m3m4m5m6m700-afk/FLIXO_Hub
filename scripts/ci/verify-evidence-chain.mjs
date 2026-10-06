#!/usr/bin/env node

const SHA = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

export function validateEvidenceChain(chain) {
  const errors = [];
  if (!chain || typeof chain !== 'object') return { ok: false, errors: ['chain:missing'] };
  for (const key of ['sourceSha', 'buildSha', 'deploymentSha']) {
    if (!SHA.test(String(chain[key] ?? ''))) errors.push(key + ':invalid');
  }
  if (!SHA256.test(String(chain.artifactDigest ?? ''))) errors.push('artifactDigest:invalid');
  for (const key of ['attestationRef', 'deploymentId', 'environment']) {
    if (typeof chain[key] !== 'string' || !chain[key].trim()) errors.push(key + ':missing');
  }
  if (chain.testedSha !== chain.sourceSha) errors.push('testedSha:not-source');
  if (chain.builtSha !== chain.sourceSha) errors.push('builtSha:not-source');
  if (chain.deploymentSha !== chain.sourceSha) errors.push('deploymentSha:not-source');
  if (chain.environment === 'production' && chain.productionVerified !== true) errors.push('production:unverified');
  return { ok: errors.length === 0, errors };
}

async function main() {
  const chunks = [];
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) chunks.push(chunk);
  const chain = JSON.parse(chunks.join(''));
  const result = validateEvidenceChain(chain);
  if (!result.ok) {
    console.error('EVIDENCE_CHAIN=FAIL');
    for (const error of result.errors) console.error(error);
    process.exit(1);
  }
  console.log('EVIDENCE_CHAIN=PASS');
  console.log('SOURCE_SHA=' + chain.sourceSha);
  console.log('DEPLOYMENT_SHA=' + chain.deploymentSha);
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll('\\', '/'))) await main();
