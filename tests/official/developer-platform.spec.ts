import { expect, test } from '@playwright/test';

test('developer platform exposes the governed programming workspace', async ({ page }) => {
  await page.goto('/developer');
  await expect(page).toHaveTitle(/FLIXO Hub — Developer Platform/);
  await expect(page.getByRole('heading', { name: 'منصة برمجة عامة، موحّدة وحاكمة.' })).toBeVisible();
  await expect(page.getByText('platform.execution.sandbox')).toBeVisible();
  await expect(page.getByText('Exact-SHA')).toHaveCount(2);
});

test('english developer platform exposes the same capability contract', async ({ page }) => {
  await page.goto('/en/developer');
  await expect(page).toHaveTitle(/FLIXO Hub — Developer Platform/);
  await expect(page.getByRole('heading', { name: 'A governed general-purpose programming platform.' })).toBeVisible();
  await expect(page.getByText('platform.verification.pipeline')).toBeVisible();
});
