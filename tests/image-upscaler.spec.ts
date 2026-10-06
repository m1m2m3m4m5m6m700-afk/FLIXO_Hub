import { expect, test } from './fixtures/universal-runtime-evidence';
import { assertDownload, assertImageResult, uploadFixture } from './helpers/image-tool-fixture';

test('image-upscaler: scales dimensions and downloads PNG', async ({ page }) => {
  await page.goto('/en/image-upscaler');
  await expect(page.getByRole('heading', { level: 1, name: 'Image Upscaler' })).toBeVisible();
  await uploadFixture(page);
  await page.getByRole('textbox', { name: 'Scale', exact: true }).fill('2');
  await page.getByRole('button', { name: 'Run tool' }).click();
  const result = await assertImageResult(page);
  expect(result.type).toBe('image/png');
  expect(result.width).toBe(8);
  expect(result.height).toBe(8);
  const downloadControl = page.getByRole('button', { name: 'Download now' });
  await expect(downloadControl).toHaveAttribute('download', 'fixture-upscaled-2x.png');
  await expect(downloadControl).toHaveAttribute('href', /^blob:/);
  await assertDownload(page, /\.png$/);
});

test('image-upscaler: rejects scales outside the canonical 1x-8x contract', async ({ page }) => {
  await page.goto('/en/image-upscaler');
  await uploadFixture(page);

  await page.getByRole('textbox', { name: 'Scale', exact: true }).fill('0.5');
  await page.getByRole('button', { name: 'Run tool' }).click();
  await expect(page.getByRole('alert')).toContainText('Scale must be between 1 and 8.');

  await page.getByRole('textbox', { name: 'Scale', exact: true }).fill('9');
  await page.getByRole('button', { name: 'Run tool' }).click();
  await expect(page.getByRole('alert')).toContainText('Scale must be between 1 and 8.');
});
