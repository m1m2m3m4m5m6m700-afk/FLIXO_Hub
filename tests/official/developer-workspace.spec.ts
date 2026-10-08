import { expect, test } from '@playwright/test';

test('local developer workspace is available without pretending to execute remote code', async ({ page }) => {
  await page.goto('/en/developer/workspace');
  await expect(page).toHaveTitle(/FLIXO Hub — Local Developer Workspace/);
  await expect(page.getByRole('heading', { name: 'Your project workspace in the browser.' })).toBeVisible();
  await expect(page.getByText(/network: none/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import project folder' })).toBeVisible();
});
