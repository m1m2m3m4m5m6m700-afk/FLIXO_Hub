import { expect, test, type Page } from '@playwright/test';

const PNG_FIXTURE = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAPUlEQVR42mP4z8DwHwwZ/oMBAwOYxQBD/xkaHBT+Kzg0/HdoUPh/IsXoP4OIhs1/Gw2R/ynTTvz/sCXgPwDaSiSJ4dCj1wAAAABJRU5ErkJggg==';
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
  if (language === 'ar') {
    const main = page.locator('main').last();
    const direction = await main.getAttribute('dir');
    if (direction !== 'rtl') await page.getByRole('button', { name: /العربية/i }).click();
    await expect(page.locator('main').last()).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('main').last()).toHaveAttribute('lang', 'ar');
  }
  if (language === 'en') {
    const main = page.locator('main').last();
    const direction = await main.getAttribute('dir');
    if (direction !== 'ltr') await page.getByRole('button', { name: /English/i }).click();
    await expect(page.locator('main').last()).toHaveAttribute('dir', 'ltr');
  }
  await page.locator('#agent-prompt').fill(prompt);
  await page.locator('#agent-file').setInputFiles(fixture());
  await page.getByRole('button', { name: language === 'ar' ? /إنشاء الخطة/i : /Build plan/i }).click();
  const plan = page.locator('[aria-label="agent-plan"]');
  await expect(plan).toContainText(toolId);
  await expect(page.locator('input[type=checkbox]')).not.toBeChecked();
  const executeButton = page.getByRole('button', { name: language === 'ar' ? /تنفيذ/i : /Execute/i });
  await expect(executeButton).toBeDisabled();
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
    await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });

  for (const [toolId, prompt] of AGENT_CASES) {
    test('agent/' + toolId + ' maps to canonical tool and requires confirmation', async ({ page }) => {
      await planAndExecuteAgent(page, toolId, prompt, 'en');
    });
  }
});
