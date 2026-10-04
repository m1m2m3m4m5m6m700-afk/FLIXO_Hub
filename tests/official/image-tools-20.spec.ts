import { expect, test } from '@playwright/test';
import { assertImageResult, uploadFixture } from '../helpers/image-tool-fixture';

const TOOLS = ["background-remover","image-upscaler","image-cropper","image-compressor","image-converter","image-effects","image-resizer","image-rotate-flip","image-brightness-contrast","image-saturation-hue","image-exposure","image-highlights-shadows","image-sharpen","image-blur","image-grayscale-duotone","image-filters","image-watermark","image-text-overlay","image-draw-annotate","image-redaction"] as const;

for (const tool of TOOLS) {
  test(`20-tool surface / ${tool} executes locally and returns an image result`, async ({ page }) => {
    const postRequests: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST') postRequests.push(request.url());
    });

    await page.goto(`/en/${tool}`);
    await uploadFixture(page);

    if (tool === 'image-watermark') {
      await page.getByLabel('Watermark text').fill('FLIXO');
    }
    if (tool === 'image-text-overlay') {
      await page.getByLabel('Overlay text').fill('FLIXO');
    }

    await page.getByRole('button', { name: /run tool|compress image/i }).first().click();
    await assertImageResult(page);

    expect(postRequests, `raw image processing must not POST: ${postRequests.join(', ')}`).toEqual([]);
  });
}
