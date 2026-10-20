import { expect, test, type Page } from '@playwright/test';
import { buildVideoFixture } from '../video/shared-video-fixture';

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
  await fileInput.setInputFiles({
    name: 'flixo-release-fixture.webm',
    mimeType: 'video/webm',
    buffer: await buildVideoFixture(page),
  });
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
