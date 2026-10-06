import { expect, test } from '@playwright/test';

test.describe('Agent 4 seed media-safety closure', () => {
  test('seed rejects empty/mismatched image inputs before rendering', async ({ page }) => {
    await page.goto('/en/seed', { waitUntil: 'domcontentloaded' });
    const input = page.locator('#seed-main-image-input');
    await expect(input).toHaveCount(1);

    await input.setInputFiles({
      name: 'spoof.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not-a-png'),
    });
    await expect(page.getByRole('alert')).toContainText(/signature|magic|safe|invalid|decode/i, { timeout: 10_000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await input.setInputFiles({
      name: 'payload.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('plain text payload'),
    });
    await expect(page.getByRole('alert')).toContainText(/unsupported|MIME|image|safe/i, { timeout: 10_000 });
  });
});
