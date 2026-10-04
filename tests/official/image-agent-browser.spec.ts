import { expect, test } from '@playwright/test';

test('Smart Intent routes English natural language to the canonical specialized tool', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/en');
  await page.getByRole('button', { name: /open smart command palette|smart intent/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Describe the task').fill('brightness contrast');

  const result = page.getByRole('dialog').getByRole('link').filter({ hasText: 'Brightness & Contrast' });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/en\/image-brightness-contrast$/);

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('Smart Intent routes Arabic natural language to the canonical image tool', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/ar');
  const root = page.locator('main.home-shell');
  await expect(root).toHaveAttribute('dir', 'rtl');

  await page.getByRole('button', { name: /فتح لوحة الأوامر الذكية|smart intent/i }).click();
  await page.getByLabel('Describe the task').fill('تعمية الصورة');

  const result = page.getByRole('dialog').getByRole('link').filter({ hasText: 'Image Redaction' });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/ar\/image-redaction$/);

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('mobile Arabic home remains usable and Smart Intent opens at 390px viewport', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ar');
  const main = page.locator('main.home-shell');
  await expect(main).toHaveAttribute('dir', 'rtl');
  await expect(main).toBeVisible();

  await page.keyboard.press('Control+K');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Describe the task')).toBeVisible();

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
