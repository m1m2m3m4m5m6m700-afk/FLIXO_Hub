import { expect, test } from '../fixtures/universal-runtime-evidence';
import { PNG } from '../helpers/image-tool-fixture';

async function readImageArtifact(page: import('@playwright/test').Page, href: string | null) {
  return page.evaluate(async (url) => {
    if (!url) throw new Error('IMAGE_OUTPUT_URL_MISSING');
    const response = await fetch(url);
    const blob = await response.blob();
    if (blob.size <= 0 || !blob.type.startsWith('image/')) throw new Error('IMAGE_OUTPUT_CONTRACT_INVALID');
    const bitmap = await createImageBitmap(blob);
    try {
      return { size: blob.size, type: blob.type, width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  }, href);
}

const IMAGE_CASES = [
  { id: 'background-remover', name: 'Background Remover', output: { type: 'image/png', width: 4, height: 4 } },
  { id: 'image-upscaler', name: 'Image Upscaler', output: { type: 'image/png', width: 8, height: 8 } },
  { id: 'image-converter', name: 'Image Converter', output: { type: 'image/webp', width: 4, height: 4 } },
  { id: 'image-cropper', name: 'Image Cropper', output: { type: 'image/png', width: 2, height: 2 } },
  { id: 'image-compressor', name: 'Image Compressor', output: { type: 'image/webp', width: 4, height: 4 } },
  { id: 'image-effects', name: 'Image Effects', output: { type: 'image/png', width: 4, height: 4 } },
] as const;

test.describe('MVP image capability individual acceptance', () => {
  for (const imageCase of IMAGE_CASES) {
    test(imageCase.id + ' executes locally and produces a measurable artifact', async ({ page }) => {
      await page.goto('/en/' + imageCase.id);
      await expect(page.getByRole('heading', { name: imageCase.name })).toBeVisible();

      await page.locator('input[type="file"]').first().setInputFiles({
        name: imageCase.id + '-fixture.png',
        mimeType: 'image/png',
        buffer: PNG,
      });

      if (imageCase.id === 'image-upscaler') {
        await page.getByLabel('Scale').fill('2');
      } else if (imageCase.id === 'image-converter') {
        await page.getByLabel('Output format').selectOption('image/webp');
      } else if (imageCase.id === 'image-cropper') {
        await page.getByLabel('X').fill('0');
        await page.getByLabel('Y').fill('0');
        await page.getByLabel('Crop width').fill('2');
        await page.getByLabel('Crop height').fill('2');
        await page.getByLabel('Output width').fill('2');
        await page.getByLabel('Output height').fill('2');
      } else if (imageCase.id === 'image-compressor') {
        await page.getByLabel('Output format').selectOption('image/webp');
        await page.getByLabel(/Quality/).fill('0.6');
      } else if (imageCase.id === 'image-effects') {
        await page.getByLabel('Contrast').fill('130');
      } else {
        await page.getByLabel('Background tolerance').fill('42');
      }

      const buttonName = imageCase.id === 'image-compressor' ? 'Compress image' : 'Run tool';
      await page.getByRole('button', { name: buttonName }).click();

      const downloadName = imageCase.id === 'image-compressor' ? 'Download image' : 'Download now';
      const downloadLink = page.getByRole('link', { name: new RegExp(downloadName, 'i') }).last();
      await expect(downloadLink).toBeVisible({ timeout: 30_000 });

      const metadata = await readImageArtifact(page, await downloadLink.getAttribute('href'));
      expect(metadata.size).toBeGreaterThan(0);
      expect(metadata.type).toBe(imageCase.output.type);
      expect(metadata.width).toBe(imageCase.output.width);
      expect(metadata.height).toBe(imageCase.output.height);
    });
  }
});

test('image tools reject a malformed PNG signature before expensive processing', async ({ page }) => {
  await page.goto('/en/image-upscaler');
  await page.getByLabel('Choose an image').setInputFiles({
    name: 'malformed.png',
    mimeType: 'image/png',
    buffer: Buffer.from('NOT-A-PNG'),
  });
  await page.getByRole('button', { name: 'Run tool' }).click();
  await expect(page.getByRole('alert')).toContainText('Upload Security Boundary');
});
