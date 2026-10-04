import { expect, test, type Page } from '@playwright/test';
import { PNG } from '../helpers/image-tool-fixture';
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
  ['image-effects', 'adjust image effects'],
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
    buffer: PNG,
  };
}

async function executeManual(page: Page, toolId: (typeof MANUAL_TOOL_IDS)[number]) {
  await page.goto('/en/' + toolId, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1,h2').filter({ hasText: /./ }).first()).toBeVisible();
  const fileInput = page.locator('input[type=file]').first();
  await expect(fileInput).toHaveCount(1);
  await fileInput.setInputFiles(fixture());

  if (toolId === 'image-cropper') {
    await page.getByRole('textbox', { name: 'Crop width' }).fill('4');
    await page.getByRole('textbox', { name: 'Crop height' }).fill('4');
    await page.getByRole('textbox', { name: 'Output width' }).fill('4');
    await page.getByRole('textbox', { name: 'Output height' }).fill('4');
  }

  const runButton = toolId === 'image-compressor'
    ? page.getByRole('button', { name: /Compress image/i })
    : page.getByRole('button', { name: /Run tool/i });
  await expect(runButton).toBeEnabled({ timeout: 10_000 });
  await runButton.click();
  await expect(page.locator('a[download]').first()).toBeVisible({ timeout: 20_000 });
}

async function planAndExecuteAgent(page: Page, toolId: string, prompt: string, language: 'ar' | 'en') {
  await page.goto('/agent', { waitUntil: 'domcontentloaded' });
  const main = page.locator('main').last();
  const direction = await main.getAttribute('dir');
  const expectedDirection = language === 'ar' ? 'rtl' : 'ltr';
  if (direction !== expectedDirection) {
    await main.locator('header button').first().click();
  }
  await expect(main).toHaveAttribute('dir', expectedDirection);
  await expect(main).toHaveAttribute('lang', language);
  await page.locator('#agent-prompt').fill(prompt);
  await page.locator('#agent-file').setInputFiles(fixture());
  const buildButton = page.locator('main').last().locator('section').first().getByRole('button').first();
  await expect(buildButton).toBeEnabled({ timeout: 10_000 });
  await buildButton.click();
  const plan = page.locator('[aria-label="agent-plan"]');
  await expect(plan).toContainText(toolId);
  const confirmation = plan.locator('input[type=checkbox]');
  await expect(confirmation).not.toBeChecked();
  const executeButton = plan.getByRole('button').first();
  await expect(executeButton).toBeDisabled();
  await expect(page.locator('[aria-label="agent-result"]')).toHaveCount(0);
  await confirmation.check();
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
