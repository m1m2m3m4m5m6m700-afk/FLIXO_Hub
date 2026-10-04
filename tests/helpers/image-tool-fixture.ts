import { expect, type Page } from '@playwright/test';

// 4x4 RGBA PNG with distinct pixels so browser image decoders and rendering paths
// can be verified without relying on a near-white/low-information fixture.
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAPUlEQVR42mP4z8DwHwwZ/oMBAwOYxQBD/xkaHBT+Kzg0/HdoUPh/IsXoP4OIhs1/Gw2R/ynTTvz/sCXgPwDaSiSJ4dCj1wAAAABJRU5ErkJggg==', 'base64');

export async function uploadFixture(page: Page, name = 'fixture.png') {
  await page.locator('#image-tool-file, input[type="file"]').first().setInputFiles({ name, mimeType: 'image/png', buffer: PNG });
}

export async function assertImageResult(page: Page) {
  const result = page.locator('img[alt="Tool result"]');
  await expect(result).toBeVisible();
  await expect.poll(async () => result.evaluate((image) => {
    const candidate = image as HTMLImageElement;
    return candidate.complete && candidate.naturalWidth > 0 && candidate.naturalHeight > 0;
  }), { message: 'Tool result image was not decoded before inspection.' }).toBe(true);
  const meta = await page.evaluate(async () => {
    const image = document.querySelector('img[alt="Tool result"]') as HTMLImageElement | null;
    if (!image) throw new Error('Tool result image not found.');
    if (typeof image.decode === 'function') await image.decode();
    const response = await fetch(image.src);
    if (!response.ok) throw new Error(`Output blob fetch failed: ${response.status}`);
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { type: blob.type, size: blob.size, width: image.naturalWidth, height: image.naturalHeight, bytes: Array.from(bytes) };
  });
  expect(meta.size).toBeGreaterThan(20);
  expect(meta.width).toBeGreaterThan(0);
  expect(meta.height).toBeGreaterThan(0);
  expect(meta.bytes.length).toBe(meta.size);
  return meta;
}

export async function captureDownload(page: Page) {
  const downloadLink = page.getByRole('link', { name: /Download image|Download now/i });
  await expect(downloadLink).toBeVisible();

  const metadata = await downloadLink.evaluate(async (element) => {
    const link = element as HTMLAnchorElement;
    const href = link.href;
    const filename = link.download;
    if (!filename) throw new Error('Download link is missing a filename.');
    if (!href.startsWith('blob:')) throw new Error('Download link is not browser-local.');
    const response = await fetch(href);
    if (!response.ok) throw new Error(`Download resource fetch failed: ${response.status}`);
    const blob = await response.blob();
    if (blob.size <= 0) throw new Error('Download resource is empty.');
    return { filename, size: blob.size };
  });

  return {
    suggestedFilename: () => metadata.filename,
    size: metadata.size,
  };
}

export async function assertDownload(page: Page, pattern: RegExp) {
  const download = await captureDownload(page);
  expect(download.suggestedFilename()).toMatch(pattern);
  expect(download.suggestedFilename()).not.toContain('undefined');
  return download;
}
