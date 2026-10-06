import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { executeCanonicalChain, executeCanonicalTool } from '../src/lib/execution/canonical-executor.ts';
import { MVP_EXECUTABLE_TOOL_IDS } from '../src/config/manual-capability-definition.ts';

test('every current MVP capability resolves through the canonical executor boundary', async () => {
  assert.equal(MVP_EXECUTABLE_TOOL_IDS.length, 10);
  for (const toolId of MVP_EXECUTABLE_TOOL_IDS) {
    const isVideo = toolId.startsWith('video-');
    const file = isVideo
      ? new File(['not-a-real-video'], 'fixture.webm', { type: 'video/webm' })
      : new File(['not-a-real-image'], 'fixture.png', { type: 'image/png' });
    await assert.rejects(
      () => executeCanonicalTool(toolId, { blob: file, fileName: file.name }, {}),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        return !/no canonical executor is registered|executor is registered/i.test(message);
      },
      toolId,
    );
  }
});

test('canonical executor rejects unknown and non-executable capabilities before processing', async () => {
  const file = new File(['x'], 'fixture.png', { type: 'image/png' });
  await assert.rejects(
    () => executeCanonicalTool('not-a-tool', { blob: file, fileName: file.name }),
    /unknown tool/i,
  );
  await assert.rejects(
    () => executeCanonicalTool('object-remover', { blob: file, fileName: file.name }),
    /not executable|release-ready/i,
  );
});

test('canonical chain is bounded and fail-closed', async () => {
  const file = new File(['x'], 'fixture.png', { type: 'image/png' });
  await assert.rejects(
    () => executeCanonicalChain([], { blob: file, fileName: file.name }),
    /between 1 and 4/i,
  );
  await assert.rejects(
    () => executeCanonicalChain(Array.from({ length: 5 }, () => ({ toolId: 'image-converter' })), { blob: file, fileName: file.name }),
    /between 1 and 4/i,
  );
});



test('MVP UI execution paths contain no raw-file network egress APIs', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const source = (relativePath: string) => readFileSync(resolve(root, relativePath), 'utf8');

  const activePaths = [
    'src/tools/image-converter/index.tsx',
    'src/tools/image-cropper/index.tsx',
    'src/tools/image-compressor/index.tsx',
    'src/tools/image-toolkit/index.tsx',
    'src/tools/video-local/index.tsx',
  ];

  for (const relativePath of activePaths) {
    const text = source(relativePath);
    assert.doesNotMatch(text, /(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\([^\n]*file\b/iu, relativePath);
    assert.doesNotMatch(text, /FormData[^\n]*(?:file|blob)/iu, relativePath);
  }
});

test('active MVP UI paths do not expose a direct engine execution bypass', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const source = (relativePath: string) => readFileSync(resolve(root, relativePath), 'utf8');

  assert.match(
    source('src/tools/image-converter/index.tsx'),
    /executeCanonicalTool\('image-converter'/u,
  );
  assert.doesNotMatch(
    source('src/tools/image-converter/index.tsx'),
    /image-toolkit\/engine/u,
  );

  assert.match(
    source('src/tools/image-cropper/index.tsx'),
    /executeCanonicalTool\('image-cropper'/u,
  );
  assert.doesNotMatch(
    source('src/tools/image-cropper/index.tsx'),
    /image-toolkit\/engine/u,
  );

  assert.match(
    source('src/tools/image-compressor/index.tsx'),
    /executeCanonicalTool\('image-compressor'/u,
  );
  assert.doesNotMatch(
    source('src/tools/image-compressor/index.tsx'),
    /compressImage\(/u,
  );

  const imageToolkit = source('src/tools/image-toolkit/index.tsx');
  assert.match(imageToolkit, /executeCanonicalTool\('background-remover'/u);
  assert.match(imageToolkit, /executeCanonicalTool\('image-upscaler'/u);
  assert.doesNotMatch(imageToolkit, /removeBackground\(/u);
  assert.doesNotMatch(imageToolkit, /resizeImage\(/u);
  assert.match(imageToolkit, /executeCanonicalTool\('image-converter'/u);
  assert.doesNotMatch(imageToolkit, /convertImage\(/u);

  const imageEffects = source('src/tools/_shared/browser-image.tsx');
  assert.match(imageEffects, /executeCanonicalTool\('image-effects'/u);
  assert.doesNotMatch(imageEffects, /runImageEffectsWorker\(/u);

  assert.match(
    source('src/tools/video-local/index.tsx'),
    /executeCanonicalTool\(id/u,
  );
  assert.doesNotMatch(
    source('src/tools/video-local/index.tsx'),
    /video-executor/u,
  );

  const chainAdapters = source('src/lib/tool-chain-adapters.ts');
  assert.match(chainAdapters, /executeCanonicalTool/u);
  assert.doesNotMatch(chainAdapters, /\.\.\/tools\//u);
  assert.doesNotMatch(chainAdapters, /\.\/video\//u);

  assert.equal(
    existsSync(resolve(root, 'src/lib/video/video-tool-executors.ts')),
    false,
  );
});

test('canonical video output verification releases its object URL', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const executor = readFileSync(resolve(root, 'src/lib/execution/canonical-executor.ts'), 'utf8');
  assert.match(executor, /video\.removeAttribute\('src'\)[\s\S]*URL\.revokeObjectURL\(url\)/u);
});

test('video renderer cleans active media resources on every terminal path', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const executor = readFileSync(resolve(root, 'src/lib/video/video-executor.ts'), 'utf8');
  assert.match(executor, /if \(recorder && recorder\.state !== 'inactive'\)[\s\S]*recorder\.stop\(\)/u);
  assert.match(executor, /canvasStream\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/u);
  assert.match(executor, /sourceStream\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/u);
  assert.match(executor, /if \(frameHandle\) cancelAnimationFrame\(frameHandle\)/u);
});

test('tool-chain panel UI matches the canonical chain/media boundary', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const panel = readFileSync(resolve(root, 'src/components/tool-chain-panel.tsx'), 'utf8');
  assert.match(panel, /\{selected\.length\}\/4 steps/u);
  assert.match(panel, /selected\.length >= 4/u);
  assert.match(panel, /accept="image\/\*,video\/\*"/u);
});

test('canonical executor enforces container signatures for supported video MIME types', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const executor = readFileSync(resolve(root, 'src/lib/execution/canonical-executor.ts'), 'utf8');
  assert.match(executor, /input\.blob\.type === 'video\\/webm' \|\| input\.blob\.type === 'video\\/x-matroska'/u);
  assert.match(executor, /bytes: \[0x1a, 0x45, 0xdf, 0xa3\]/u);
  assert.match(executor, /input\.blob\.type === 'video\\/mp4' \|\| input\.blob\.type === 'video\\/quicktime'/u);
  assert.match(executor, /offset: 4/u);
  assert.match(executor, /input\.blob\.type === 'video\\/ogg'/u);
  assert.match(executor, /bytes: \[0x4f, 0x67, 0x67, 0x53\]/u);
  assert.match(executor, /magicBytes: isVideo/u);
});
