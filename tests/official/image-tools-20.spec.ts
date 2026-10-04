import { expect, test } from '@playwright/test';
import { assertDownload, assertImageResult, uploadFixture } from '../helpers/image-tool-fixture';

const TOOLS = ["background-remover","image-upscaler","image-cropper","image-compressor","image-converter","image-effects","image-resizer","image-rotate-flip","image-brightness-contrast","image-saturation-hue","image-exposure","image-highlights-shadows","image-sharpen","image-blur","image-grayscale-duotone","image-filters","image-watermark","image-text-overlay","image-draw-annotate","image-redaction"] as const;

for (const tool of TOOLS) {
  test('20-tool surface / ' + tool + ' executes locally, survives repeat, and returns a downloadable image', async ({ page }) => {
    const postRequests: string[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST') postRequests.push(request.url());
    });
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/en/' + tool);
    await uploadFixture(page);

    if (tool === 'image-watermark') {
      await page.getByLabel('Watermark text').fill('FLIXO');
    }
    if (tool === 'image-text-overlay') {
      await page.getByLabel('Overlay text').fill('FLIXO');
    }

    const runButton = page.getByRole('button', { name: /run tool|compress image/i }).first();
    await runButton.click();
    await assertImageResult(page);

    await runButton.click();
    await assertImageResult(page);

    const downloadButton = page.getByRole('button', { name: /download now/i });
    await expect(downloadButton).toBeVisible();
    const download = await assertDownload(page, /.+/);
    expect(download.suggestedFilename()).toMatch(/\.[a-z0-9]+$/i);

    expect(postRequests, 'raw image processing must not POST: ' + postRequests.join(', ')).toEqual([]);
    expect(consoleErrors, 'unexpected browser console errors').toEqual([]);
    expect(pageErrors, 'unexpected page errors').toEqual([]);
  });
}
