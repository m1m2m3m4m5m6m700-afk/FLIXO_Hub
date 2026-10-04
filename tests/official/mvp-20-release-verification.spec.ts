import { expect, test, type Page } from '@playwright/test';

const PNG_FIXTURE = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAPUlEQVR42mP4z8DwHwwZ/oMBAwOYxQBD/xkaHBT+Kzg0/HdoUPh/IsXoP4OIhs1/Gw2R/ynTTvz/sCXgPwDaSiSJ4dCj1wAAAABJRU5ErkJggg==';
const MANUAL_TOOL_IDS = [
  'background-remover','image-upscaler','image-cropper','image-compressor','image-converter','image-effects',
  'image-resizer','image-rotate-flip','image-brightness-contrast','image-saturation-hue','image-exposure',
  'image-highlights-shadows','image-sharpen','image-blur','image-grayscale-duotone','image-filters',
  'image-watermark','image-text-overlay','image-draw-annotate','image-redaction',
] as const;

const AGENT_CASES = [
  ['background-remover', 'remove the background'],
  ['image-upscaler', 'upscale this image'],
  ['image-cropper', 'crop this image to square'],
  ['image-compressor', 'compress my image'],
  ['image-converter', 'convert this image to webp'],
  ['image-effects', 'increase brightness and contrast'],
  ['image-resizer', 'resize the image'],
  ['image-rotate-flip', 'rotate and flip the image'],
  ['image-brightness-contrast', 'increase brightness and contrast'],
  ['image-saturation-hue', 'increase saturation and hue'],
  ['image-exposure', 'increase exposure'],
  ['image-highlights-shadows', 'adjust highlights and shadows'],
  ['image-sharpen', 'sharpen the image'],
  ['image-blur', 'blur the image'],
  ['image-grayscale-duotone', 'apply duotone mapping'],
  ['image-filters', 'use photo filters'],
  ['image-watermark', 'add a watermark'],
  ['image-text-overlay', 'add text to the image'],
  ['image-draw-annotate', 'draw an arrow on the image'],
  ['image-redaction', 'redact a region of the image'],
] as const;

function fixture() {
  return {
    name: 'flixo-release-fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_FIXTURE, 'base64'),
  };
}

async function executeManual(page: Page, toolId: (typeof MANUAL_TOOL_IDS)[number]) {
  await page.goto('/en/' + toolId, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1,h2').filter({ hasText: /./ }).first()).toBeVisible();
  const fileInput = page.locator('input[type=file]').first();
  await expect(fileInput).toHaveCount(1);
  await fileInput.setInputFiles(fixture());
  await expect(page.getByText('Before')).toHaveCount(1);

  if (toolId === 'image-cropper') {
    await page.getByRole('textbox', { name: 'Crop width' }).fill('4');
    await page.getByRole('textbox', { name: 'Crop height' }).fill('4');
    await page.getByRole('textbox', { name: 'Output width' }).fill('4');
    await page.getByRole('textbox', { name: 'Output height' }).fill('4');
  }

  if (toolId === 'image-compressor') {
    const runButton = page.getByRole('button', { name: /Compress image/i });
    await expect(runButton).toBeEnabled({ timeout: 10_000 });
    await runButton.click();
    await expect(page.locator('a[download]').first()).toBeVisible({ timeout: 20_000 });
  } else if (toolId === 'image-effects') {
    const runButton = page.getByRole('button', { name: /Run tool/i });
    await expect(runButton).toBeEnabled({ timeout: 10_000 });
    await runButton.click();
    await expect(page.locator('img[alt]').last()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Download/i })).toBeVisible({ timeout: 20_000 });
  } else {
    const runButton = page.getByRole('button', { name: /Run tool/i });
    await expect(runButton).toBeEnabled({ timeout: 10_000 });
    await runButton.click();
    await expect(page.locator('a[download]').first()).toBeVisible({ timeout: 20_000 });
  }
}

async function planAndExecuteAgent(page: Page, toolId: string, prompt: string, language: 'ar' | 'en') {
  await page.goto('/agent', { waitUntil: 'domcontentloaded' });
  const main = page.locator('main').last();
  await expect(main).toBeVisible();
  const toggleButton = page.getByRole('button', { name: /English|العربية/i }).first();
  await expect(toggleButton).toBeVisible();

  const currentLanguage = await main.getAttribute('lang');
  if (language === 'ar' && currentLanguage !== 'ar') {
    await page.getByRole('button', { name: /العربية/i }).click();
  } else if (language === 'en' && currentLanguage !== 'en') {
    await page.getByRole('button', { name: /English/i }).click();
  }

  await expect(main).toHaveAttribute('lang', language);
  await expect(main).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');

  await page.locator('#agent-prompt').fill(prompt);
  await page.locator('#agent-file').setInputFiles(fixture());
  const planButton = page.getByRole('button', { name: language === 'ar' ? /إنشاء الخطة/i : /Build plan/i });
  await expect(planButton).toBeEnabled({ timeout: 10_000 });
  await planButton.click();

  const plan = page.locator('[aria-label="agent-plan"]');
  await expect(plan).toContainText(toolId);
  await expect(page.locator('input[type=checkbox]')).not.toBeChecked();
  const executeButton = page.getByRole('button', { name: language === 'ar' ? /تنفيذ/i : /Execute/i });
  await expect(executeButton).toBeDisabled();
  await expect(page.locator('[aria-label="agent-result"]')).toHaveCount(0);
  await page.locator('input[type=checkbox]').check();
  await executeButton.click();
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
    await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });

  for (const [toolId, prompt] of AGENT_CASES) {
    test('agent/' + toolId + ' maps to canonical tool and requires confirmation', async ({ page }) => {
      await planAndExecuteAgent(page, toolId, prompt, 'en');
    });
  }
});
