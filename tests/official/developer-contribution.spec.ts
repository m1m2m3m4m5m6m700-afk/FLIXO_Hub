import { expect, test } from '@playwright/test';

test('contribution workspace is explicit about admission and local export', async ({ page }) => {
  await page.goto('/developer/contribute');
  await expect(page).toHaveTitle(/FLIXO Hub — Contribution/);
  await expect(page.getByRole('heading', { name: 'Turn an idea into an evidence-bound contribution.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Validate proposal/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Export proposal JSON/ })).toBeVisible();
});
