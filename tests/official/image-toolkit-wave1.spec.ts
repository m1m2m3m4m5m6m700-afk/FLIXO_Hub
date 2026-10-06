import { expect, test } from '@playwright/test';

const UNPUBLISHED_IDS = [
  'image-resizer',
  'image-hue',
  'image-pixelate',
  'image-padding',
  'image-rounded-corners',
] as const;

test.describe('MVP scope freeze for unreleased image capabilities', () => {
  for (const toolId of UNPUBLISHED_IDS) {
    test(toolId + ' remains unavailable until promoted into the canonical MVP scope', async ({ page }) => {
      const response = await page.goto('/en/' + toolId);
      expect(response?.status()).toBe(200);

      await expect(page.getByRole('heading', { name: 'Tool not found' })).toBeVisible();
      await expect(page.locator('#image-tool-file')).toHaveCount(0);
      await expect(page.locator('a[download]')).toHaveCount(0);
    });
  }
});
