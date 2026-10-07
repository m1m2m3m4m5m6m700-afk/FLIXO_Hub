import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { executeCanonicalChain, executeCanonicalTool, runBoundedExecutionAttempts } from '../src/lib/execution/canonical-executor.ts';
import { MVP_EXECUTABLE_TOOL_IDS } from '../src/config/manual-capability-definition.ts';
import { readRasterHeaderDimensions } from '../src/lib/contracts/file-safety.ts';

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


test('canonical retry policy is bounded to three attempts and returns the first success', async () => {
  let attempts = 0;
  const result = await runBoundedExecutionAttempts(99, async (attempt) => {
    attempts += 1;
    if (attempt < 3) throw new Error('transient failure');
    return 'ok';
  });
  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
});

test('canonical retry exhaustion returns the final failure and never exceeds the configured cap', async () => {
  let attempts = 0;
  await assert.rejects(
    () => runBoundedExecutionAttempts(99, async () => {
      attempts += 1;
      throw new Error('permanent failure #' + attempts);
    }),
    /permanent failure #3/i,
  );
  assert.equal(attempts, 3);
});

test('canonical retry loop stops immediately when the caller aborts', async () => {
  const controller = new AbortController();
  let attempts = 0;
  await assert.rejects(
    () => runBoundedExecutionAttempts(3, async () => {
      attempts += 1;
      controller.abort();
      throw new DOMException('cancelled', 'AbortError');
    }, controller.signal),
    /cancelled/i,
  );
  assert.equal(attempts, 1);
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

test('canonical video media boundaries use the local blob URL adapter with deterministic cleanup', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const canonical = readFileSync(resolve(root, 'src/lib/execution/canonical-executor.ts'), 'utf8');
  const renderer = readFileSync(resolve(root, 'src/lib/video/video-executor.ts'), 'utf8');
  const verifier = readFileSync(resolve(root, 'src/lib/execution/canonical-executor.ts'), 'utf8');
  const adapter = readFileSync(resolve(root, 'src/lib/video/blob-video-source.ts'), 'utf8');

  assert.match(canonical, /attachVideoBlobSource\(video, input\.blob, signal\)/u);
  assert.match(canonical, /attachVideoBlobSource\(video, output\.blob, signal\)/u);
  assert.match(renderer, /attachVideoBlobSource\(video, inputBlob, operationController\.signal\)/u);
  assert.match(verifier, /attachVideoBlobSource\(video, output\.blob, signal\)/u);
  assert.match(adapter, /URL\.createObjectURL\(blob\)/u);
  assert.match(adapter, /video\.src = url/u);
  assert.match(adapter, /URL\.revokeObjectURL\(url\)/u);
  assert.match(adapter, /video\.removeAttribute\('src'\)/u);
  assert.doesNotMatch(adapter, /new MediaSourceClass\(\)/u);
  assert.doesNotMatch(adapter, /sourceBuffer\.appendBuffer\(bytes\)/u);
});

test('video renderer cleans active media resources on every terminal path', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const executor = readFileSync(resolve(root, 'src/lib/video/video-executor.ts'), 'utf8');
  assert.match(executor, /if \(recorder && recorder\.state !== 'inactive'\)[\s\S]*recorder\.stop\(\)/u);
  assert.match(executor, /canvasStream\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/u);
  assert.match(executor, /if \(frameInterval\) clearInterval\(frameInterval\)/u);
  assert.match(executor, /frameInterval = setInterval\(draw, Math\.max\(4, Math\.round\(1000 \/ fps\)\)\)/u);
});

test('video result Blob URLs are lifecycle-managed instead of being created during render', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const ui = readFileSync(resolve(root, 'src/tools/video-local/index.tsx'), 'utf8');
  assert.match(ui, /const \[resultUrl, setResultUrl\]/u);
  assert.match(ui, /const url = URL\.createObjectURL\(output\.blob\)/u);
  assert.match(ui, /setResultUrl\(url\)/u);
  assert.match(ui, /URL\.revokeObjectURL\(resultUrlRef\.current\)/u);
  assert.match(ui, /return \(\) => \{/u);
  assert.match(ui, /href=\{resultUrl\}/u);
});

test('tool-chain panel UI matches the canonical chain/media boundary', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const panel = readFileSync(resolve(root, 'src/components/tool-chain-panel.tsx'), 'utf8');
  assert.match(panel, /\{selected\.length\}\/4 steps/u);
  assert.match(panel, /selected\.length >= 4/u);
  assert.match(panel, /accept="image\/\*,video\/\*"/u);
});

test('image effects are declared and routed through the browser worker boundary', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const capabilities = readFileSync(resolve(root, 'src/config/manual-capability-definition.ts'), 'utf8');
  const executor = readFileSync(resolve(root, 'src/lib/execution/canonical-executor.ts'), 'utf8');
  const workerPath = resolve(root, 'src/lib/execution/image-effects.worker.ts');

  assert.ok(existsSync(workerPath));
  assert.match(capabilities, /id === "image-effects" \? "browser-worker" : "browser-local"/u);
  assert.match(executor, /new Worker\(new URL\('\.\/image-effects\.worker\.ts', import\.meta\.url\), \{ type: 'module' \}\)/u);
  assert.match(executor, /worker\.terminate\(\)/u);
  assert.match(executor, /signal\?\.addEventListener\('abort', onAbort, \{ once: true \}\)/u);
});

test('canonical executor validates the bounded signature probe against its own length', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const executor = readFileSync(resolve(root, 'src/lib/execution/canonical-executor.ts'), 'utf8');
  assert.match(executor, /const contentProbeBytes = contentPrefix\.byteLength/u);
  assert.match(executor, /bytes: contentProbeBytes,\s*content: contentPrefix/u);
  assert.match(
    executor,
    /if \(input\.blob\.size <= 0 \|\| input\.blob\.size > maxBytes\)/u,
  );
});

test('canonical executor enforces container signatures for supported video MIME types', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const executor = readFileSync(resolve(root, 'src/lib/execution/canonical-executor.ts'), 'utf8');
  assert.ok(executor.includes("input.blob.type === 'video/webm' || input.blob.type === 'video/x-matroska'"));
  assert.ok(executor.includes("bytes: [0x1a, 0x45, 0xdf, 0xa3]"));
  assert.ok(executor.includes("input.blob.type === 'video/mp4' || input.blob.type === 'video/quicktime'"));
  assert.ok(executor.includes("offset: 4"));
  assert.ok(executor.includes("input.blob.type === 'video/ogg'"));
  assert.ok(executor.includes("bytes: [0x4f, 0x67, 0x67, 0x53]"));
  assert.ok(executor.includes("magicBytes: isVideo"));
});

test('canonical execution deadlines actively abort downstream processing', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const executor = readFileSync(resolve(root, 'src/lib/execution/canonical-executor.ts'), 'utf8');
  assert.match(executor, /const executionController = new AbortController\(\)/u);
  assert.match(executor, /const executionSignal = executionController\.signal/u);
  assert.match(executor, /timeoutController\?\.abort\(\)/u);
  assert.match(executor, /withDeadline\([\s\S]*executionController/u);
  assert.match(executor, /executionController\.abort\(\)/u);
});


test('unused duplicate media safety authority stays removed', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  assert.equal(existsSync(resolve(root, 'src/lib/media/media-safety.ts')), false);
});

test('image-effects worker uses the canonical file-safety authority and MVP scope has one guard', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const worker = readFileSync(resolve(root, 'src/lib/execution/image-effects.worker.ts'), 'utf8');
  const safety = readFileSync(resolve(root, 'src/lib/contracts/file-safety.ts'), 'utf8');
  const mvpScope = readFileSync(resolve(root, 'src/lib/contracts/mvp-scope.ts'), 'utf8');

  assert.match(worker, /from '..\/contracts\/file-safety\.ts'/u);
  assert.doesNotMatch(worker, /media\/media-safety/u);
  assert.match(safety, /export const MEDIA_LIMITS/u);
  assert.match(safety, /export async function assertSafeRasterInput/u);
  assert.match(safety, /export async function assertRasterOutput/u);
  assert.equal((mvpScope.match(/export function assertMvpScope\(/gu) ?? []).length, 1);
});


test('raster dimension admission is decoder-free and detects oversized PNG headers', async () => {
  const bytes = new Uint8Array(24);
  bytes.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a], 0);
  bytes.set([0x00,0x00,0x00,0x0d], 8);
  bytes.set([0x49,0x48,0x44,0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 100_000, false);
  view.setUint32(20, 100_000, false);
  const dimensions = await readRasterHeaderDimensions(new Blob([bytes], { type: 'image/png' }), 'image/png');
  assert.deepEqual(dimensions, { width: 100_000, height: 100_000 });
  assert.ok((dimensions!.width * dimensions!.height) > 100_000_000);
});

test('image-effects is fail-closed when the worker boundary is unavailable', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const executor = readFileSync(resolve(root, 'src/lib/execution/canonical-executor.ts'), 'utf8');
  assert.match(executor, /IMAGE_EFFECTS_WORKER_UNAVAILABLE/u);
  assert.doesNotMatch(executor, /executeImageEffectsFallback/u);
  assert.doesNotMatch(executor, /catch\(async \(error\) =>[\s\S]*executeImageEffectsFallback/u);
});


test('privileged CI publication is separated from candidate analysis', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const triage = readFileSync(resolve(root, '.github/workflows/triage-and-clean.yml'), 'utf8');
  const publish = triage.slice(triage.indexOf('  publish:'));
  assert.match(triage, /permissions:\s+contents: read/iu);
  assert.match(triage, /persist-credentials: false/u);
  assert.match(triage, / {2}publish:[\s\S]*permissions:\s+contents: write/iu);
  assert.doesNotMatch(publish, /\.agent-intelligence\/scripts\/(?:triage|reaper|validate)\.py/u);
});

test('hosted CSRF configuration is fail-closed', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const csrf = readFileSync(resolve(root, 'src/lib/server/security/csrf.ts'), 'utf8');
  assert.match(csrf, /process\.env\.NODE_ENV === 'production' \|\| process\.env\.VERCEL === '1'/u);
  assert.match(csrf, /CSRF secret is required in hosted\/production environments/u);
});

test('privileged patch controller executes from trusted main source', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const workflow = readFileSync(resolve(root, '.github/workflows/patch-capsule-controller.yml'), 'utf8');
  assert.match(workflow, /ref: main/u);
  assert.match(workflow, /persist-credentials: false/u);
});

test('generated SVG integrity rejects active or external content', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const svg = readFileSync(resolve(root, 'src/tools/image-to-svg/output-integrity.ts'), 'utf8');
  assert.match(svg, /script\|foreignObject/u);
  assert.match(svg, /external SVG references are not permitted/u);
  assert.match(svg, /<!DOCTYPE\|<!ENTITY/u);
});


test('CELL lifecycle is orchestration-only and cannot become a second execution authority', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const lifecycle = readFileSync(resolve(root, 'packages/contracts/src/cell-lifecycle.ts'), 'utf8');
  const runtime = readFileSync(resolve(root, 'packages/contracts/src/cell-runtime.ts'), 'utf8');
  const canonical = readFileSync(resolve(root, 'src/lib/execution/canonical-executor.ts'), 'utf8');
  const registry = readFileSync(resolve(root, 'src/config/registry.ts'), 'utf8');

  assert.doesNotMatch(lifecycle, /src\\/(?:tools|config\\/registry)|canonical-executor/u);
  assert.match(runtime, /CellLifecycleRuntime/u);
  assert.match(canonical, /getToolById\\(toolId\\)/u);
  assert.match(canonical, /getToolOutputContract/u);
  assert.match(canonical, /assertToolOutputContract/u);
  assert.match(registry, /export const TOOL_REGISTRY/u);
  assert.match(registry, /export const TOOL_CATALOG/u);
});
