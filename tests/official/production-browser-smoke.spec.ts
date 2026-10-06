import { expect, test } from '../fixtures/universal-runtime-evidence';

const MVP_IDS = [
  'background-remover',
  'image-upscaler',
  'image-cropper',
  'image-compressor',
  'image-converter',
  'image-effects',
  'video-trimmer',
  'video-cropper',
  'video-resizer',
  'video-compressor',
] as const;

test.describe('Production browser verification', () => {
  test('official home, tool discovery, and Arabic locale are browser-clean', async ({ page }) => {
    const root = await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(root?.status()).toBe(200);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('.official-home')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Your digital tools');

    const tools = await page.goto('/tools', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(tools?.status()).toBe(200);
    await expect(page.locator('.tools-modern')).toBeVisible();
    const hrefs = await page.locator('.tools-modern-tool-grid a').evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname));
    expect(hrefs).toHaveLength(MVP_IDS.length);
    for (const id of MVP_IDS) expect(hrefs).toContain('/en/' + id);

    const arabicTools = await page.goto('/ar/tools', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(arabicTools?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('.tools-modern')).toBeVisible();
    const arabicHrefs = await page.locator('.tools-modern-tool-grid a').evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname));
    expect(arabicHrefs).toHaveLength(MVP_IDS.length);
    for (const id of MVP_IDS) expect(arabicHrefs).toContain('/ar/' + id);

    const blocked = await page.goto('/en/filter-mask', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(blocked?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tool not found');
    await expect(page.locator('[data-flixo-i18n-root="tool-surface"]')).toHaveCount(0);
  });

  test('Arabic tool route preserves RTL and the canonical tool workflow shell', async ({ page }) => {
    const arabic = await page.goto('/ar/image-upscaler', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(arabic?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('main').first()).toHaveAttribute('lang', 'ar');
    await expect(page.locator('main').first()).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('button', { name: 'إعادة ضبط' }).first()).toBeVisible();
  });
});
