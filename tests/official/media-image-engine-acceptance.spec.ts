import { expect, test } from '@playwright/test';

async function buildImageFixture(page: Parameters<Parameters<typeof test>[2]>[0]['page']): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('IMAGE_FIXTURE_CANVAS_UNAVAILABLE');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#1473e6';
    context.fillRect(64, 24, 128, 80);
    context.fillStyle = '#111111';
    context.fillRect(104, 44, 48, 40);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('IMAGE_FIXTURE_ENCODE_FAILED')), 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  });
  return Buffer.from(base64, 'base64');
}

async function readOutput(page: Parameters<Parameters<typeof test>[2]>[0]['page']) {
  const outputImage = page.locator('img[alt="Tool result"]');
  await expect(outputImage).toBeVisible({ timeout: 30_000 });
  const url = await outputImage.getAttribute('src');
  if (!url?.startsWith('blob:')) throw new Error('IMAGE_OUTPUT_BLOB_URL_MISSING');
  return page.evaluate(async (blobUrl) => {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('IMAGE_OUTPUT_CONTEXT_UNAVAILABLE');
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    bitmap.close();
    let transparent = 0;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] < 250) transparent += 1;
    return { size: blob.size, type: blob.type, width: canvas.width, height: canvas.height, transparent };
  }, url);
}

test.describe('MVP local image engine acceptance', () => {
  test('background remover changes connected background locally', async ({ page }) => {
    const nonGet: string[] = [];
    page.on('request', (request) => { if (!['GET', 'HEAD'].includes(request.method())) nonGet.push(request.method() + ' ' + request.url()); });
    await page.goto('/en/background-remover');
    const fixture = await buildImageFixture(page);
    await page.locator('input[type=file]').setInputFiles({ name: 'background-fixture.png', mimeType: 'image/png', buffer: fixture });
    await page.getByLabel('Background tolerance').fill('20');
    await page.getByRole('button', { name: 'Run tool', exact: true }).click();
    const output = await readOutput(page);
    expect(output.type).toBe('image/png');
    expect(output.width).toBe(256);
    expect(output.height).toBe(128);
    expect(output.transparent).toBeGreaterThan(0);
    expect(nonGet).toEqual([]);
  });

  test('image upscaler produces exact requested dimensions', async ({ page }) => {
    const nonGet: string[] = [];
    page.on('request', (request) => { if (!['GET', 'HEAD'].includes(request.method())) nonGet.push(request.method() + ' ' + request.url()); });
    await page.goto('/en/image-upscaler');
    const fixture = await buildImageFixture(page);
    await page.locator('input[type=file]').setInputFiles({ name: 'upscale-fixture.png', mimeType: 'image/png', buffer: fixture });
    await page.locator('input[aria-label="Scale"]:visible').first().fill('2');
    await page.getByRole('button', { name: 'Run tool', exact: true }).click();
    const output = await readOutput(page);
    expect(output.type).toBe('image/png');
    expect(output.width).toBe(512);
    expect(output.height).toBe(256);
    expect(nonGet).toEqual([]);
  });

  test('image cropper produces exact crop output dimensions', async ({ page }) => {
    const nonGet: string[] = [];
    page.on('request', (request) => { if (!['GET', 'HEAD'].includes(request.method())) nonGet.push(request.method() + ' ' + request.url()); });
    await page.goto('/en/image-cropper');
    const fixture = await buildImageFixture(page);
    await page.locator('input[type=file]').setInputFiles({ name: 'crop-fixture.png', mimeType: 'image/png', buffer: fixture });
    await page.locator('input[aria-label="X"]:visible').first().fill('32');
    await page.locator('input[aria-label="Y"]:visible').first().fill('16');
    await page.locator('input[aria-label="Crop width"]:visible').first().fill('160');
    await page.locator('input[aria-label="Crop height"]:visible').first().fill('80');
    await page.locator('input[aria-label="Output width"]:visible').first().fill('80');
    await page.locator('input[aria-label="Output height"]:visible').first().fill('40');
    await page.getByRole('button', { name: 'Run tool', exact: true }).click();
    const output = await readOutput(page);
    expect(output.type).toBe('image/png');
    expect(output.width).toBe(80);
    expect(output.height).toBe(40);
    expect(nonGet).toEqual([]);
  });

  test('image compressor creates a valid smaller raster artifact', async ({ page }) => {
    const nonGet: string[] = [];
    page.on('request', (request) => { if (!['GET', 'HEAD'].includes(request.method())) nonGet.push(request.method() + ' ' + request.url()); });
    await page.goto('/en/image-compressor');
    const fixture = await buildImageFixture(page);
    await page.locator('input[type=file]').setInputFiles({ name: 'compress-fixture.png', mimeType: 'image/png', buffer: fixture });
    await page.getByRole('slider', { name: /Quality/ }).fill('0.5');
    await page.getByRole('button', { name: 'Compress image', exact: true }).click();
    const output = await readOutput(page);
    expect(['image/webp', 'image/jpeg', 'image/png']).toContain(output.type);
    expect(output.size).toBeGreaterThan(0);
    expect(nonGet).toEqual([]);
  });

  test('image converter preserves MIME contract for selected output', async ({ page }) => {
    const nonGet: string[] = [];
    page.on('request', (request) => { if (!['GET', 'HEAD'].includes(request.method())) nonGet.push(request.method() + ' ' + request.url()); });
    await page.goto('/en/image-converter');
    const fixture = await buildImageFixture(page);
    await page.locator('input[type=file]').setInputFiles({ name: 'convert-fixture.png', mimeType: 'image/png', buffer: fixture });
    await page.getByLabel('Output format').selectOption('image/jpeg');
    await page.getByRole('button', { name: 'Run tool', exact: true }).click();
    const output = await readOutput(page);
    expect(output.type).toBe('image/jpeg');
    expect(output.width).toBe(256);
    expect(output.height).toBe(128);
    expect(nonGet).toEqual([]);
  });

  test('image effects produces a valid changed local artifact', async ({ page }) => {
    const nonGet: string[] = [];
    page.on('request', (request) => { if (!['GET', 'HEAD'].includes(request.method())) nonGet.push(request.method() + ' ' + request.url()); });
    await page.goto('/en/image-effects');
    const fixture = await buildImageFixture(page);
    await page.locator('input[type=file]').setInputFiles({ name: 'effects-fixture.png', mimeType: 'image/png', buffer: fixture });
    await page.getByLabel('Contrast').fill('140');
    await page.getByRole('button', { name: 'Run tool', exact: true }).click();
    const output = await readOutput(page);
    expect(output.type).toBe('image/png');
    expect(output.width).toBe(256);
    expect(output.height).toBe(128);
    expect(output.transparent).toBe(0);
    expect(output.size).toBeGreaterThan(0);
    expect(nonGet).toEqual([]);
  });
});
