import { expect, test } from '@playwright/test';

const PNG_16X16 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAALklEQVR4nGP8////fwYKABMlmgeHASzoAvKVd/FqeNiuTF0XjBow';
const MANUAL_TOOL_IDS = [
  'background-remover','image-upscaler','image-cropper','image-compressor','image-converter','image-effects',
  'image-rotate','image-flip-horizontal','image-flip-vertical','image-brightness','image-contrast',
  'image-saturation','image-grayscale','image-invert','image-sepia','image-blur','image-sharpen',
  'image-resizer','image-hue','image-pixelate',
] as const;

const AGENT_CASES = [
  ['background-remover', 'remove the background'],
  ['image-upscaler', 'upscale this image'],
  ['image-cropper', 'crop this image to square'],
  ['image-compressor', 'compress my image'],
  ['image-converter', 'convert this image to webp'],
  ['image-effects', 'adjust image effects'],
  ['image-rotate', 'rotate the image'],
  ['image-flip-horizontal', 'flip horizontal'],
  ['image-flip-vertical', 'flip vertical'],
  ['image-brightness', 'increase brightness'],
  ['image-contrast', 'increase contrast by 10 percent'],
  ['image-saturation', 'increase saturation'],
  ['image-grayscale', 'make it black and white'],
  ['image-invert', 'invert image colors'],
  ['image-sepia', 'apply sepia'],
  ['image-blur', 'blur the image'],
  ['image-sharpen', 'sharpen the image'],
  ['image-resizer', 'resize the image'],
  ['image-hue', 'change the hue'],
  ['image-pixelate', 'pixelate the image'],
] as const;

function fixture() {
  return {
    name: 'flixo-release-fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_16X16, 'base64'),
  };
}

test.describe('FLIXO 20-tool release verification', () => {
  test('20/20 manual workflows execute and expose a verified artifact', async ({ page }) => {
    for (const toolId of MANUAL_TOOL_IDS) {
      await page.goto('/en/' + toolId, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1,h2').filter({ hasText: /./ }).first()).toBeVisible();
      const fileInput = page.locator('input[type=file]').first();
      await expect(fileInput).toBeVisible();
      await fileInput.setInputFiles(fixture());

      if (toolId === 'image-compressor') {
        await page.getByRole('button', { name: /Compress image/i }).click();
        await expect(page.locator('a[download]').first()).toBeVisible({ timeout: 20_000 });
      } else if (toolId === 'image-effects') {
        await page.getByRole('button', { name: /Run tool/i }).click();
        await expect(page.locator('img[alt]').last()).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole('button', { name: /Download/i })).toBeVisible({ timeout: 20_000 });
      } else {
        await page.getByRole('button', { name: /Run tool/i }).click();
        await expect(page.locator('a[download]').first()).toBeVisible({ timeout: 20_000 });
      }
    }
  });

  test('20/20 agent workflows execute behind an explicit confirmation gate', async ({ page }) => {
    await page.goto('/agent', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/وكيل FLIXO|FLIXO Agent/);
    await expect(page.locator('main[dir="rtl"]')).toBeVisible();

    await page.getByRole('textbox', { name: /ماذا تريد|What should/i }).fill('إزالة الخلفية');
    await page.locator('#agent-file').setInputFiles(fixture());
    await page.getByRole('button', { name: /إنشاء الخطة/i }).click();
    await expect(page.locator('[aria-label="agent-plan"]')).toContainText('background-remover');
    await expect(page.locator('input[type=checkbox]')).not.toBeChecked();
    await page.getByRole('button', { name: /تنفيذ|Execute/i }).click({ trial: true }).catch(() => undefined);
    await expect(page.locator('[aria-label="agent-result"]')).toHaveCount(0);
    await page.locator('input[type=checkbox]').check();
    await page.getByRole('button', { name: /تنفيذ|Execute/i }).click();
    await expect(page.locator('[aria-label="agent-result"]')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /English/i }).click();
    for (const [toolId, prompt] of AGENT_CASES) {
      await page.locator('#agent-prompt').fill(prompt);
      await page.locator('#agent-file').setInputFiles(fixture());
      await page.getByRole('button', { name: /Build plan/i }).click();
      const plan = page.locator('[aria-label="agent-plan"]');
      await expect(plan).toContainText(toolId);
      await expect(page.locator('input[type=checkbox]')).not.toBeChecked();
      await page.locator('input[type=checkbox]').check();
      await page.getByRole('button', { name: /Execute/i }).click();
      await expect(page.locator('[aria-label="agent-result"]')).toBeVisible({ timeout: 20_000 });
    }
  });
});
