import { expect, test } from '../fixtures/universal-runtime-evidence';

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngHeader(width: number, height: number): Buffer {
  const header = Buffer.alloc(24);
  pngSignature.copy(header, 0);
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  return header;
}

test.describe('Agent 3 — Seed media safety adversarial coverage', () => {
  test('rejects fake MIME / signature mismatch before decode', async ({ page }) => {
    await page.goto('/en/seed');
    await page.locator('#seed-main-image-input').setInputFiles({
      name: 'spoof.png',
      mimeType: 'image/png',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x00, 0x00]),
    });

    await expect(page.getByRole('alert')).toContainText('file magic bytes do not match an allowed signature');
  });

  test('rejects oversized input before decode', async ({ page }) => {
    await page.goto('/en/seed');
    await page.locator('#seed-main-image-input').setInputFiles({
      name: 'oversized.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(25 * 1024 * 1024 + 1),
    });

    await expect(page.getByRole('alert')).toContainText('file exceeds the maximum size');
  });

  test('rejects excessive declared dimensions before decode', async ({ page }) => {
    await page.goto('/en/seed');
    await page.locator('#seed-main-image-input').setInputFiles({
      name: 'huge.png',
      mimeType: 'image/png',
      buffer: pngHeader(10_000, 5_000),
    });

    await expect(page.getByRole('alert')).toContainText('pixel count exceeds policy limit');
  });

  test('rejects malformed image payload after byte/signature validation', async ({ page }) => {
    await page.goto('/en/seed');
    await page.locator('#seed-main-image-input').setInputFiles({
      name: 'malformed.png',
      mimeType: 'image/png',
      buffer: pngHeader(1, 1),
    });

    await expect(page.getByRole('alert')).toContainText('Unable to decode the image after security validation');
  });

  test('rejects extension mismatch at the same safety boundary', async ({ page }) => {
    await page.goto('/en/seed');
    await page.locator('#seed-main-image-input').setInputFiles({
      name: 'mismatch.jpg',
      mimeType: 'image/png',
      buffer: pngHeader(1, 1),
    });

    await expect(page.getByRole('alert')).toContainText('unsupported file extension');
  });
});
