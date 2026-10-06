import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('RT-08 Gitleaks allowlists are narrowly scoped to known non-secret historical detections', async () => {
  const config = await readFile('.gitleaks.toml', 'utf8');
  assert.match(config, /useDefault = true/u);
  assert.match(config, /condition = "AND"/u);
  assert.match(config, /commits = \[[\s\S]*c5184d553a96199dc91001e7d775a69078ca65cd[\s\S]*1ced2a86f8a08311341342cbc446ebd5f8959fe4[\s\S]*\]/u);
  assert.doesNotMatch(config, /paths = \[[\s\S]*\.env|secrets|credentials/i);
  assert.match(config, /communicationStore\\.ts/u);
  assert.match(config, /jwt-decoder\\.tsx/u);
});

test('RT-08 Secret Scan checks exact candidate, execution, and main with full history and redaction', async () => {
  const workflow = await readFile('.github/workflows/secret-scan.yml', 'utf8');
  assert.match(workflow, /fetch-depth: 0/u);
  assert.match(workflow, /label: PR-or-push-candidate/u);
  assert.match(workflow, /label: execution/u);
  assert.match(workflow, /label: main/u);
  assert.match(workflow, /Verify exact scan SHA/u);
  assert.match(workflow, /gitleaks git \. --config \.gitleaks\.toml --redact --no-banner --exit-code 1/u);
  assert.match(workflow, /GITLEAKS_VERSION: '8\.30\.1'/u);
  assert.match(workflow, /GITLEAKS_SHA256: '[0-9a-f]{64}'/u);
});

test('RT-13 has no moving third-party OCR main-runtime URL or worker blob fallback', async () => {
  const source = await readFile('src/tools/image-toolkit/ocr-worker-client.ts', 'utf8');
  assert.doesNotMatch(source, /tesseract\.js@(latest|\^|~)|@main|@master/u);
  assert.match(source, /\/vendor\/tesseract\/6\.0\.1\/tesseract\.min\.js/u);
  assert.match(source, /\/vendor\/tesseract\/6\.0\.1\/worker\.min\.js/u);
  assert.match(source, /workerBlobURL:\s*false/u);
  assert.match(source, /cacheMethod:\s*'none'/u);
});

test('RT-12 canonical browser safety is wired into Seed, Pix, shared workbench, and compressor', async () => {
  const files = {
    seed: await readFile('src/tools/seed/index.tsx', 'utf8'),
    pix: await readFile('src/tools/pix/index.tsx', 'utf8'),
    workbench: await readFile('src/components/image-tool/ToolWorkbench.tsx', 'utf8'),
    compressor: await readFile('src/tools/image-compressor/file-safety.ts', 'utf8'),
  };
  assert.match(files.seed, /validateBrowserFile/u);
  assert.match(files.pix, /validateBrowserFile/u);
  assert.match(files.workbench, /validateBrowserFile/u);
  assert.match(files.compressor, /assertSafeImageFile/u);
  for (const source of Object.values(files)) {
    assert.doesNotMatch(source, /file\.type\.startsWith\(['"]image\//u);
  }
});
