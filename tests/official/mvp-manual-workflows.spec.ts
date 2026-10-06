import { expect, test, type Page } from '../fixtures/universal-runtime-evidence';

test.setTimeout(120_000);

async function buildImageFixture(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('IMAGE_FIXTURE_CANVAS_UNAVAILABLE');
    context.fillStyle = '#173b2a';
    context.fillRect(0, 0, 256, 256);
    context.fillStyle = '#e33b3b';
    context.fillRect(72, 72, 112, 112);
    context.fillStyle = '#ffffff';
    context.fillRect(100, 100, 56, 56);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('IMAGE_FIXTURE_ENCODING_FAILED')), 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(binary);
  });
  return Buffer.from(base64, 'base64');
}

async function prepareImage(page: Page, fixture: Buffer): Promise<void> {
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'flixo-mvp-fixture.png',
    mimeType: 'image/png',
    buffer: fixture,
  });
}

async function assertDownloadArtifact(page: Page): Promise<void> {
  const artifact = page.locator('a[download]').filter({ hasText: /Download|تنزيل/u }).first();
  await expect(artifact).toBeVisible({ timeout: 30_000 });
  const href = await artifact.getAttribute('href');
  expect(href).toMatch(/^blob:/u);
}

test.describe('MVP manual image workflows', () => {
  test('background-remover: select → configure → execute → verify → download → reset', async ({ page }) => {
    await page.goto('/en/background-remover');
    const fixture = await buildImageFixture(page);
    await prepareImage(page, fixture);
    await page.getByLabel('Background tolerance').fill('42');
    await page.getByRole('button', { name: 'Run tool' }).click();
    await assertDownloadArtifact(page);
    await page.getByRole('button', { name: 'Reset' }).last().click();
    await expect(page.getByText('No result yet.')).toBeVisible();
  });

  test('image-upscaler: select → configure scale → execute → verified result → reset', async ({ page }) => {
    await page.goto('/en/image-upscaler');
    const fixture = await buildImageFixture(page);
    await prepareImage(page, fixture);
    await page.getByLabel('Scale').fill('2');
    await page.getByRole('button', { name: 'Run tool' }).click();
    await expect(page.locator('img[alt="Tool result"]')).toBeVisible({ timeout: 30_000 });
    await assertDownloadArtifact(page);
    await page.getByRole('button', { name: 'Reset' }).last().click();
    await expect(page.getByText('No result yet.')).toBeVisible();
  });

  test('image-cropper: configure exact output dimensions and download result', async ({ page }) => {
    await page.goto('/en/image-cropper');
    const fixture = await buildImageFixture(page);
    await prepareImage(page, fixture);
    await page.getByLabel('Crop width').fill('128');
    await page.getByLabel('Crop height').fill('128');
    await page.getByLabel('Output width').fill('128');
    await page.getByLabel('Output height').fill('128');
    await page.getByRole('button', { name: 'Run tool' }).click();
    await assertDownloadArtifact(page);
    await page.getByRole('button', { name: 'Reset' }).last().click();
    await expect(page.getByText('No result yet.')).toBeVisible();
  });

  test('image-compressor: configure format/quality and download result', async ({ page }) => {
    await page.goto('/en/image-compressor');
    const fixture = await buildImageFixture(page);
    await prepareImage(page, fixture);
    await page.getByLabel('Output format').selectOption('image/webp');
    await page.getByRole('button', { name: 'Compress image' }).click();
    await assertDownloadArtifact(page);
    await page.getByRole('button', { name: 'Reset' }).last().click();
    await expect(page.getByText('No result yet.')).toBeVisible();
  });

  test('image-converter: choose output format and download result', async ({ page }) => {
    await page.goto('/en/image-converter');
    const fixture = await buildImageFixture(page);
    await prepareImage(page, fixture);
    await page.getByLabel('Output format').selectOption('image/jpeg');
    await page.getByRole('button', { name: 'Run tool' }).click();
    await assertDownloadArtifact(page);
    await page.getByRole('button', { name: 'Reset' }).last().click();
    await expect(page.getByText('No result yet.')).toBeVisible();
  });

  test('image-effects: select → adjust → execute → download → reset', async ({ page }) => {
    await page.goto('/en/image-effects');
    const fixture = await buildImageFixture(page);
    await prepareImage(page, fixture);
    await page.getByLabel('Brightness').fill('120');
    await page.getByRole('button', { name: 'Run tool' }).click();
    await expect(page.getByRole('img', { name: 'Tool result' })).toBeVisible({ timeout: 30_000 });
    const downloadButton = page.getByRole('button', { name: 'Download now' });
    await expect(downloadButton).toBeVisible();
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByText('No result yet.')).toBeVisible();
  });

  test('invalid image input is rejected visibly without claiming execution', async ({ page }) => {
    await page.goto('/en/image-effects');
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'not-an-image.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image', 'utf8'),
    });
    await page.getByRole('button', { name: 'Run tool' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/Input rejected|image first|operation failed/i);
  });
});
