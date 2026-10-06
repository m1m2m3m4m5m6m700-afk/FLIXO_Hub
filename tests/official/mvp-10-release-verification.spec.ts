import { expect, test, type Page } from '@playwright/test';

const PNG_FIXTURE = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAPUlEQVR42mP4z8DwHwwZ/oMBAwOYxQBD/xkaHBT+Kzg0/HdoUPh/IsXoP4OIhs1/Gw2R/ynTTvz/sCXgPwDaSiSJ4dCj1wAAAABJRU5ErkJggg==';
const IMAGE_TOOL_IDS = [
  'background-remover',
  'image-upscaler',
  'image-cropper',
  'image-compressor',
  'image-converter',
  'image-effects',
] as const;
const VIDEO_TOOL_IDS = [
  'video-trimmer',
  'video-cropper',
  'video-resizer',
  'video-compressor',
] as const;
const VIDEO_FIXTURE_DURATION_MS = 2_400;

function imageFixture() {
  return {
    name: 'flixo-release-fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_FIXTURE, 'base64'),
  };
}

async function meaningfulImageFixture(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas context unavailable');

    context.fillStyle = '#f5f5f5';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#202020';
    context.fillRect(27, 27, 74, 74);
    context.fillStyle = '#d24a2e';
    context.beginPath();
    context.arc(64, 64, 27, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f0c74a';
    context.fillRect(50, 50, 28, 28);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('could not encode fixture')), 'image/png');
    });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  return {
    name: 'flixo-release-fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(bytes),
  };
}

async function videoFixture(page: Page) {
  const base64 = await page.evaluate(async (durationMs: number) => {
    if (typeof MediaRecorder === 'undefined') throw new Error('VIDEO_FIXTURE_MEDIARECORDER_UNAVAILABLE');
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('VIDEO_FIXTURE_CANVAS_UNAVAILABLE');

    const candidates = [
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    const mimeType = candidates.find((candidate) =>
      typeof MediaRecorder.isTypeSupported !== 'function' || MediaRecorder.isTypeSupported(candidate),
    );
    if (!mimeType) throw new Error('VIDEO_FIXTURE_WEBM_UNAVAILABLE');

    const stream = canvas.captureStream(15);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    const finished = new Promise<void>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error('VIDEO_FIXTURE_RECORDING_FAILED'));
      recorder.onstop = () => resolve();
    });

    recorder.start();
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const draw = () => {
        const elapsed = performance.now() - started;
        context.fillStyle = '#111827';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = elapsed < 400 ? '#22c55e' : '#3b82f6';
        context.fillRect(30, 30, 120 + Math.min(120, elapsed / 5), 120);
        context.fillStyle = '#ffffff';
        context.font = '24px sans-serif';
        context.fillText('FLIXO VIDEO FIXTURE', 25, 165);
        if (elapsed >= durationMs) {
          recorder.stop();
          resolve();
          return;
        }
        requestAnimationFrame(draw);
      };
      draw();
    });

    await finished;
    stream.getTracks().forEach((track) => track.stop());

    const blob = new Blob(chunks, { type: 'video/webm' });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const batch = 0x8000;
    for (let index = 0; index < bytes.length; index += batch) {
      binary += String.fromCharCode(...bytes.subarray(index, index + batch));
    }
    return btoa(binary);
  }, VIDEO_FIXTURE_DURATION_MS);

  return {
    name: 'flixo-release-fixture.webm',
    mimeType: 'video/webm',
    buffer: Buffer.from(base64, 'base64'),
  };
}

async function executeManualImage(page: Page, toolId: (typeof IMAGE_TOOL_IDS)[number]) {
  await page.goto('/en/' + toolId, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1,h2').filter({ hasText: /./ }).first()).toBeVisible();
  const fileInput = page.locator('input[type=file]').first();
  await expect(fileInput).toHaveCount(1);
  const fixture = ['background-remover', 'image-compressor', 'image-effects'].includes(toolId)
    ? await meaningfulImageFixture(page)
    : imageFixture();
  await fileInput.setInputFiles(fixture);

  if (toolId === 'image-cropper') {
    await page.getByRole('textbox', { name: 'Crop width' }).fill('4');
    await page.getByRole('textbox', { name: 'Crop height' }).fill('4');
    await page.getByRole('textbox', { name: 'Output width' }).fill('4');
    await page.getByRole('textbox', { name: 'Output height' }).fill('4');
  }

  const runButton = page.getByRole('button', { name: toolId === 'image-compressor' ? /Compress image/i : /Run tool/i });
  await expect(runButton).toBeEnabled({ timeout: 10_000 });
  await runButton.click();
  const runtimeError = await page.locator('[role="alert"]').allTextContents();
  const downloadControl = toolId === 'image-effects'
    ? page.getByRole('button', { name: /Download now/i })
    : page.locator('a[download]').first();
  await expect(downloadControl, `manual/${toolId} output missing; visible runtime errors: ${runtimeError.join(' | ')}`).toBeVisible({ timeout: 20_000 });
}

async function executeManualVideo(page: Page, toolId: (typeof VIDEO_TOOL_IDS)[number]) {
  await page.goto('/en/' + toolId, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Local video processing/i })).toBeVisible();
  const fileInput = page.getByLabel('Choose video');
  await fileInput.setInputFiles(await videoFixture(page));
  await expect(page.getByRole('button', { name: /Process video/i })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole('button', { name: /Process video/i }).click();
  const runtimeError = await page.locator('[role="alert"]').allTextContents();
  const downloadControl = page.locator('a[download]').first();
  await expect(downloadControl, `manual/${toolId} output missing; visible runtime errors: ${runtimeError.join(' | ')}`).toBeVisible({ timeout: 90_000 });
}

test.describe('FLIXO ten-tool release verification', () => {
  for (const toolId of IMAGE_TOOL_IDS) {
    test('manual/' + toolId + ' executes locally and exposes an artifact', async ({ page }) => {
      await executeManualImage(page, toolId);
    });
  }

  test.describe('video manual release lane', () => {
    test.describe.configure({ mode: 'serial', timeout: 90_000 });

    for (const toolId of VIDEO_TOOL_IDS) {
      test('manual/' + toolId + ' executes locally and exposes an artifact', async ({ page }) => {
        await executeManualVideo(page, toolId);
      });
    }
  });

  test('manual/background-remover does not send raw fixture bytes over the network', async ({ page }) => {
    const fixture = await meaningfulImageFixture(page);
    const unexpected: Array<{ url: string; method: string; reason: string }> = [];
    const fixtureBase64 = fixture.buffer.toString('base64');
    const fixtureBuffer = fixture.buffer;

    page.on('request', (request) => {
      const url = request.url();
      const method = request.method();
      const bodyText = request.postData();
      const bodyBytes = request.postDataBuffer();
      if (bodyText?.includes(fixtureBase64) || (bodyBytes && bodyBytes.includes(fixtureBuffer))) {
        unexpected.push({ url, method, reason: 'request body contains raw fixture bytes or base64 fixture payload' });
      }
    });

    await page.goto('/en/background-remover', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#image-tool-file');
    await fileInput.setInputFiles(fixture);
    await page.getByRole('button', { name: 'Run tool' }).click();
    await expect(page.locator('a[download]').first()).toBeVisible({ timeout: 20_000 });

    expect(unexpected, unexpected.map((item) => item.method + ' ' + item.url + ' — ' + item.reason).join(' | ')).toEqual([]);
  });

});
