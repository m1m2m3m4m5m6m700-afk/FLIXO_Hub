import { test, expect } from '@playwright/test';

test('Hub processes a file locally without external network requests', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol !== 'data:') {
      externalRequests.push(request.url());
    }
  });

  await page.goto('/hub', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'FLIXO Hub' })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: 'hub-stage1.bin',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('FLIXO-HUB-STAGE1-LOCAL-DATA', 'utf8'),
  });

  await page.getByRole('button', { name: /شغّل المعالجة المحلية|Run local processing/ }).click();
  await expect(page.getByText(/checksum/)).toBeVisible({ timeout: 15_000 });
  expect(externalRequests).toEqual([]);
});

test('Hub privacy page is reachable in Arabic and English', async ({ page }) => {
  await page.goto('/hub/privacy');
  await expect(page.getByRole('heading', { name: 'خصوصية FLIXO Hub' })).toBeVisible();

  await page.goto('/en/hub/privacy');
  await expect(page.getByRole('heading', { name: 'FLIXO Hub privacy' })).toBeVisible();
});
