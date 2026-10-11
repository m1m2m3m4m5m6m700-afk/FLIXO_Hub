// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from '@playwright/test';

const locales = ['ar', 'en', 'fr'] as const;
const repositoryUrl = 'https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub';

test.describe('FLIXO attribution footer', () => {
  for (const locale of locales) {
    test(locale + ' exposes the attribution and source links', async ({ page }) => {
      await page.goto('/' + locale);
      const footer = page.getByTestId('flixo-attribution');

      await expect(footer).toBeVisible();
      await expect(
        footer.getByRole('link', { name: 'Powered by FLIXO Hub' }),
      ).toHaveAttribute('href', repositoryUrl);
      await expect(
        footer.getByRole('link', { name: 'Source' }),
      ).toHaveAttribute('href', repositoryUrl);
    });
  }
});
