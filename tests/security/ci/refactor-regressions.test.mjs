import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

test('architecture: executable capability schema has one canonical source', () => {
  const registry = read('src/lib/tools/tool-registry.ts');
  const manual = read('src/config/manual-capability-definition.ts');
  const canonical = read('src/config/canonical-tool-definition.ts');

  assert.match(registry, /export const PARAMETER_SCHEMAS/u);
  assert.match(registry, /export const MVP_EXECUTABLE_TOOL_IDS/u);
  assert.match(registry, /export const CAPABILITY_DEFINITIONS/u);

  assert.match(manual, /@deprecated/u);
  assert.match(manual, /export \* from/u);
  assert.doesNotMatch(manual, /const PARAMETER_SCHEMAS/u);
  assert.doesNotMatch(manual, /const MVP_EXECUTABLE_TOOL_IDS/u);

  assert.match(canonical, /tool-registry\.ts/u);
  assert.doesNotMatch(canonical, /const PARAMETER_SCHEMAS/u);
});

test('media runtime: worker and canvas lifecycle guards remain explicit', () => {
  const compressorEngine = read('src/tools/image-compressor/engine.ts');
  const compressorWorker = read('src/tools/image-compressor/compressor.worker.ts');
  const effectsWorker = read('src/tools/_shared/image-effects-worker.ts');
  const ocrWorker = read('src/tools/image-toolkit/ocr-worker.ts');
  const ocrClient = read('src/tools/image-toolkit/ocr-worker-client.ts');
  const browserImage = read('src/tools/_shared/browser-image.tsx');
  const compressorUi = read('src/tools/image-compressor/index.tsx');

  assert.match(compressorEngine, /WORKER_TIMEOUT_MS/u);
  assert.match(compressorEngine, /worker\.terminate\(\)/u);
  assert.match(compressorEngine, /canvas\.width = 0/u);

  assert.match(compressorWorker, /bitmap\?\.close\(\)/u);
  assert.match(compressorWorker, /canvas\.width = 0/u);
  assert.match(effectsWorker, /image\?\.close\(\)/u);
  assert.match(effectsWorker, /canvas\.width = 0/u);
  assert.match(ocrWorker, /image\?\.close\(\)/u);
  assert.match(ocrWorker, /canvas\.width = 0/u);
  assert.match(ocrClient, /OCR_WORKER_TIMEOUT_MS/u);
  assert.match(ocrClient, /worker\.terminate\(\)/u);

  assert.match(browserImage, /useEffect/u);
  assert.match(browserImage, /URL\.revokeObjectURL\(url\)/u);
  assert.match(compressorUi, /MAX_BATCH_INPUT_BYTES/u);
});

test('certification artifacts: attestation markdown lives outside the primary docs surface and runtime evidence is generated', () => {
  const names = [
    'FLIXO-EXACT-SHA-CERTIFICATION.md',
    'FLIXO-FINAL-CERTIFICATION-ATTESTATION.md',
    'FLIXO-FINAL-RELEASE-CERTIFICATION.md',
    'RED-TEAM-CERTIFICATION.md',
    'THREE-CRITIC-REVIEW.md',
  ];

  for (const name of names) {
    assert.equal(existsSync(`docs/${name}`), false, `legacy attestation path still exists: ${name}`);
    assert.equal(existsSync(`docs/attestations/${name}`), true, `moved attestation is missing: ${name}`);
  }

  const evidenceScript = read('scripts/ci/generate-build-evidence.mjs');
  const workflow = read('.github/workflows/ci.yml');
  assert.match(evidenceScript, /flixo\.runtime-build-evidence\.v1/u);
  assert.match(workflow, /Generate runtime build evidence/u);
  assert.match(workflow, /scripts\/ci\/generate-build-evidence\.mjs/u);
  assert.match(workflow, /path: dist/u);
});
