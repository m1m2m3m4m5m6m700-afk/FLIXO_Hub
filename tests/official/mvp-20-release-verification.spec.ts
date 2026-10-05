import { expect, test, type Page } from '@playwright/test';
import { PNG, assertImageResult, uploadFixture } from '../helpers/image-tool-fixture';

const MANUAL_TOOL_IDS = [
  'background-remover',
  'image-upscaler',
  'image-cropper',
  'image-compressor',
  'image-converter',
  'image-effects',
  'image-resizer',
  'image-rotate-flip',
  'image-brightness-contrast',
  'image-saturation-hue',
  'image-exposure',
  'image-highlights-shadows',
  'image-sharpen',
  'image-blur',
  'image-grayscale-duotone',
  'image-filters',
  'image-watermark',
  'image-text-overlay',
  'image-draw-annotate',
  'image-redaction',
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

async function executeManual(page: Page, toolId: (typeof MANUAL_TOOL_IDS)[number]) {
  await page.goto('/en/' + toolId, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('h1,h2').filter({ hasText: /./ }).first()).toBeVisible();
  const fileInput = page.locator('input[type=file]').first();
  await expect(fileInput).toHaveCount(1);
  await uploadFixture(page);

  if (toolId === 'image-cropper') {
    await page.getByRole('textbox', { name: 'Crop width' }).fill('4');
    await page.getByRole('textbox', { name: 'Crop height' }).fill('4');
    await page.getByRole('textbox', { name: 'Output width' }).fill('4');
    await page.getByRole('textbox', { name: 'Output height' }).fill('4');
  }

  if (toolId === 'image-watermark') {
    await page.getByLabel('Watermark text').fill('FLIXO');
  }
  if (toolId === 'image-text-overlay') {
    await page.getByLabel('Overlay text').fill('FLIXO');
  }

  const runButton = page.getByRole('button', { name: /Run tool|Compress image/i }).first();
  await expect(runButton).toBeEnabled({ timeout: 10_000 });
  await runButton.click();
  await assertImageResult(page);
}

async function configureLanguage(page: Page, language: 'ar' | 'en') {
  const main = page.locator('main').last();
  await expect(main).toBeVisible();
  const current = await main.getAttribute('lang');
  if (current !== language) await page.getByTestId('agent-language-toggle').click();
  await expect(main).toHaveAttribute('lang', language);
  await expect(main).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
}

async function planAndExecuteAgent(page: Page, toolId: string, prompt: string, language: 'ar' | 'en') {
  await page.goto('/agent', { waitUntil: 'domcontentloaded' });
  await configureLanguage(page, language);

  await page.locator('#agent-prompt').fill(prompt);
  await page.locator('#agent-file').setInputFiles({
    name: 'flixo-agent-fixture.png',
    mimeType: 'image/png',
    buffer: PNG,
  });

  const buildButton = page.getByTestId('agent-build-plan');
  await expect(buildButton).toBeEnabled({ timeout: 10_000 });
  await buildButton.click();

  const plan = page.locator('[aria-label="agent-plan"]');
  await expect(plan).toContainText(toolId);
  const confirmation = page.getByTestId('agent-confirmation');
  await expect(confirmation).not.toBeChecked();

  const executeButton = page.getByTestId('agent-execute');
  await expect(executeButton).toBeDisabled();
  await expect(page.locator('[aria-label="agent-result"]')).toHaveCount(0);

  await confirmation.check();
  await expect(executeButton).toBeEnabled();
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
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  for (const [toolId, prompt] of AGENT_CASES) {
    test('agent/' + toolId + ' maps to canonical tool and requires confirmation', async ({ page }) => {
      await planAndExecuteAgent(page, toolId, prompt, 'en');
    });
  }
});
