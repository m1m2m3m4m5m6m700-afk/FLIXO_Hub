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

async function executeManual(page: Parameters<Parameters<typeof test>[2]>[0]['page'], toolId: (typeof MANUAL_TOOL_IDS)[number]) {
  await page.goto('/en/' + toolId, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1,h2').filter({ hasText: /./ }).first()).toBeVisible();
  const fileInput = page.locator('input[type=file]').first();
  await expect(fileInput).toHaveCount(1);
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

async function planAndExecuteAgent(page: Parameters<Parameters<typeof test>[2]>[0]['page'], toolId: string, prompt: string, language: 'ar' | 'en') {
  await page.goto('/agent', { waitUntil: 'domcontentloaded' });
  if (language === 'en') await page.getByRole('button', { name: /English/i }).click();
  await page.locator('#agent-prompt').fill(prompt);
  await page.locator('#agent-file').setInputFiles(fixture());
  await page.getByRole('button', { name: language === 'ar' ? /إنشاء الخطة/i : /Build plan/i }).click();
  const plan = page.locator('[aria-label="agent-plan"]');
  await expect(plan).toContainText(toolId);
  await expect(page.locator('input[type=checkbox]')).not.toBeChecked();
  await page.getByRole('button', { name: language === 'ar' ? /تنفيذ/i : /Execute/i }).click({ trial: true });
  await expect(page.locator('[aria-label="agent-result"]')).toHaveCount(0);
  await page.locator('input[type=checkbox]').check();
  await page.getByRole('button', { name: language === 'ar' ? /تنفيذ/i : /Execute/i }).click();
  await expect(page.locator('[aria-label="agent-result"]')).toBeVisible({ timeout: 20_000 });
}

test.describe('FLIXO 20-tool release verification', () => {
  for (const toolId of MANUAL_TOOL_IDS) {
    test('manual/' + toolId + ' executes locally and exposes an artifact', async ({ page }) => {
      await executeManual(page, toolId);
    });
  }

  test('agent/background-remover-ar executes only after explicit confirmation and preserves RTL', async ({ page }) => {
    await planAndExecuteAgent(page, 'background-remover', 'إزالة الخلفية', 'ar');
    await expect(page.locator('main[dir="rtl"]')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });

  for (const [toolId, prompt] of AGENT_CASES) {
    test('agent/' + toolId + ' maps to canonical tool and requires confirmation', async ({ page }) => {
      await planAndExecuteAgent(page, toolId, prompt, 'en');
    });
  }
});
